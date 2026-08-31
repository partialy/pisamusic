#!/usr/bin/env node

/*
 * 使用 Cloudflare DNS-01 续签证书，并把新证书绑定到七牛 CDN 域名。
 * 运行前需要在 /www/wwwroot/cert/qiniu-cert.env 配置密钥。
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const tls = require('node:tls');
const { spawnSync } = require('node:child_process');

const CERT_DIR = process.env.CERT_DIR || '/www/wwwroot/cert';
const CONFIG_FILE = process.env.QINIU_CERT_ENV || path.join(CERT_DIR, 'qiniu-cert.env');
const ACME_HOME = process.env.ACME_HOME || '/root/.acme.sh';
const ACME_SH = process.env.ACME_SH || path.join(ACME_HOME, 'acme.sh');
const PRIMARY_DOMAIN = process.env.QINIU_PRIVATE_DOMAIN || 'qiniu-private-oss.partialy.cn';
const PUBLIC_DOMAIN = process.env.QINIU_PUBLIC_DOMAIN || 'qiniu-public-oss.partialy.cn';
const STATE_FILE = path.join(CERT_DIR, 'qiniu-cert-state.json');

function log(message) {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

function fail(message) {
  throw new Error(message);
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function loadConfig() {
  const fileValues = parseEnvFile(CONFIG_FILE);
  const config = { ...fileValues, ...process.env };
  if (!config.CF_Token && config.CF_API_TOKEN) config.CF_Token = config.CF_API_TOKEN;
  const required = ['QINIU_ACCESS_KEY', 'QINIU_SECRET_KEY'];
  if (!config.CF_Token) required.unshift('CF_API_TOKEN');
  const missing = required.filter((key) => !config[key]);
  if (missing.length) {
    fail(`缺少配置项: ${missing.join(', ')}（配置文件: ${CONFIG_FILE}）`);
  }
  if (fs.existsSync(CONFIG_FILE)) {
    const mode = fs.statSync(CONFIG_FILE).mode & 0o777;
    if (mode & 0o077) fail(`配置文件权限过宽，请设置为 600: ${CONFIG_FILE}`);
  }
  return config;
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    env,
    cwd: CERT_DIR,
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(`${path.basename(command)} 执行失败，退出码 ${result.status}`);
}

function sha256File(file) {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function urlSafeBase64(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

function qboxAuthorization(ak, sk, pathWithQuery) {
  const sign = crypto.createHmac('sha1', sk).update(`${pathWithQuery}\n`).digest();
  return `QBox ${ak}:${urlSafeBase64(sign)}`;
}

function qiniuAuthorization(ak, sk, method, host, requestPath, body, date) {
  const hasBody = Boolean(body);
  let signing = `${method} ${requestPath}\nHost: ${host}`;
  if (hasBody) signing += '\nContent-Type: application/json';
  signing += `\nX-Qiniu-Date: ${date}\n\n${body || ''}`;
  const sign = crypto.createHmac('sha1', sk).update(signing).digest();
  return `Qiniu ${ak}:${urlSafeBase64(sign)}`;
}

function requestJson({ host, method, requestPath, body, authorization, qiniuDate }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const headers = {
      Host: host,
      Authorization: authorization,
      Accept: 'application/json',
    };
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (qiniuDate) headers['X-Qiniu-Date'] = qiniuDate;

    const req = https.request({ host, method, path: requestPath, headers, timeout: 30000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed;
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          parsed = { raw: text };
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`${method} ${requestPath} 返回 HTTP ${res.statusCode}`);
          error.statusCode = res.statusCode;
          error.response = parsed;
          reject(error);
          return;
        }
        resolve(parsed);
      });
    });
    req.on('timeout', () => req.destroy(new Error(`${method} ${requestPath} 请求超时`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function utcDate() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

async function uploadCertificate(config, privateKeyFile, fullChainFile) {
  const body = {
    name: `pisamusic-${new Date().toISOString().slice(0, 10)}`,
    pri: fs.readFileSync(privateKeyFile, 'utf8'),
    ca: fs.readFileSync(fullChainFile, 'utf8'),
  };
  const requestPath = '/sslcert';
  const response = await requestJson({
    host: 'fusion.qiniuapi.com',
    method: 'POST',
    requestPath,
    body,
    authorization: qboxAuthorization(config.QINIU_ACCESS_KEY, config.QINIU_SECRET_KEY, requestPath),
  });
  const certId = response.certID || response.certId;
  if (!certId) fail('七牛上传证书成功但响应中没有 certID');
  log(`七牛证书上传成功，certID=${certId}`);
  return certId;
}

async function bindCertificate(config, domain, certId) {
  const date = utcDate();
  const body = { certId, forceHttps: true, http2Enable: true, tlsVersions: 'TLSv1.2/TLSv1.3' };
  const encodedDomain = encodeURIComponent(domain);
  const httpsPath = `/domain/${encodedDomain}/httpsconf`;
  const auth = qiniuAuthorization(config.QINIU_ACCESS_KEY, config.QINIU_SECRET_KEY, 'PUT', 'api.qiniu.com', httpsPath, JSON.stringify(body), date);
  try {
    await requestJson({ host: 'api.qiniu.com', method: 'PUT', requestPath: httpsPath, body, authorization: auth, qiniuDate: date });
  } catch (error) {
    const code = error.response && error.response.code;
    if (code !== 400302) throw error;
    log(`${domain} 尚未开启 HTTPS，改用 sslize 开启`);
    const sslPath = `/domain/${encodedDomain}/sslize`;
    const sslDate = utcDate();
    const sslBody = { ...body };
    const sslAuth = qiniuAuthorization(config.QINIU_ACCESS_KEY, config.QINIU_SECRET_KEY, 'PUT', 'api.qiniu.com', sslPath, JSON.stringify(sslBody), sslDate);
    await requestJson({ host: 'api.qiniu.com', method: 'PUT', requestPath: sslPath, body: sslBody, authorization: sslAuth, qiniuDate: sslDate });
  }
  log(`${domain} 已提交证书绑定，七牛侧预计需要数分钟生效`);
}

function checkTls(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: domain, port: 443, servername: domain, rejectUnauthorized: false, timeout: 20000 }, () => {
      const cert = socket.getPeerCertificate();
      log(`${domain} TLS 握手成功，证书到期时间=${cert.valid_to || '未知'}`);
      socket.end();
      resolve();
    });
    socket.on('timeout', () => {
      socket.destroy();
      log(`${domain} TLS 检查超时（证书绑定可能仍在生效）`);
      resolve();
    });
    socket.on('error', (error) => {
      log(`${domain} TLS 检查失败：${error.message}`);
      resolve();
    });
  });
}

function writeState(state) {
  const tempFile = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tempFile, STATE_FILE);
}

async function main() {
  fs.mkdirSync(CERT_DIR, { recursive: true, mode: 0o700 });
  const config = loadConfig();
  if (!fs.existsSync(ACME_SH)) fail(`未找到 acme.sh: ${ACME_SH}`);

  const privateKeyFile = path.join(CERT_DIR, 'privkey.pem');
  const fullChainFile = path.join(CERT_DIR, 'fullchain.pem');
  const beforeFingerprint = sha256File(fullChainFile);
  const acmeEnv = { ...process.env, ...config, CF_Token: config.CF_Token };

  log(`开始检查 ${PRIMARY_DOMAIN}、${PUBLIC_DOMAIN} 的证书`);
  if (!fs.existsSync(path.join(ACME_HOME, PRIMARY_DOMAIN)) && !fs.existsSync(path.join(ACME_HOME, `${PRIMARY_DOMAIN}_ecc`))) {
    run(ACME_SH, ['--issue', '--dns', 'dns_cf', '-d', PRIMARY_DOMAIN, '-d', PUBLIC_DOMAIN, '--keylength', 'ec-256', '--server', 'letsencrypt', '--home', ACME_HOME], acmeEnv);
  } else {
    run(ACME_SH, ['--renew', '-d', PRIMARY_DOMAIN, '--ecc', '--home', ACME_HOME], acmeEnv);
  }
  run(ACME_SH, ['--install-cert', '-d', PRIMARY_DOMAIN, '--ecc', '--home', ACME_HOME, '--key-file', privateKeyFile, '--fullchain-file', fullChainFile], acmeEnv);

  const afterFingerprint = sha256File(fullChainFile);
  if (!afterFingerprint) fail('acme.sh 未生成 fullchain.pem');
  if (beforeFingerprint === afterFingerprint) {
    log('证书内容没有变化，本次不重复上传七牛');
  } else {
    const certId = await uploadCertificate(config, privateKeyFile, fullChainFile);
    await bindCertificate(config, PRIMARY_DOMAIN, certId);
    await bindCertificate(config, PUBLIC_DOMAIN, certId);
    writeState({ certId, sha256: afterFingerprint, updatedAt: new Date().toISOString(), domains: [PRIMARY_DOMAIN, PUBLIC_DOMAIN] });
  }

  await checkTls(PRIMARY_DOMAIN);
  await checkTls(PUBLIC_DOMAIN);
  log('证书续签流程完成');
}

main().catch((error) => {
  log(`证书续签失败：${error.message}`);
  process.exitCode = 1;
});
