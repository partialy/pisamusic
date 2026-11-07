package cn.partialy.pm.download;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 无网络/Android 依赖的续传响应判定；任何不确定都拒绝追加。 */
public final class DownloadResumePolicy {
    private static final Pattern RANGE = Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)");
    private DownloadResumePolicy() {}
    public static long validatedTotal(String header, long offset, long savedTotal, long bodyLength, boolean validatorMatches) {
        if (!validatorMatches || header == null) return -1;
        Matcher match = RANGE.matcher(header);
        if (!match.matches()) return -1;
        try {
            long start = Long.parseLong(match.group(1)), end = Long.parseLong(match.group(2)), total = Long.parseLong(match.group(3));
            if (start != offset || end < start || end >= total || total != savedTotal || (bodyLength >= 0 && bodyLength != end - start + 1)) return -1;
            return total;
        } catch (NumberFormatException ignored) { return -1; }
    }
    /** RFC entity-tag：只接受完整强标签，不把弱标签、空白或任意字符串当验证器。 */
    public static boolean isStrongEtag(String value) {
        if (value == null || value.length() < 2 || value.charAt(0) != '"' || value.charAt(value.length() - 1) != '"') return false;
        for (int index = 1; index < value.length() - 1; index++) {
            char ch = value.charAt(index);
            if (!(ch == 0x21 || (ch >= 0x23 && ch <= 0x7e) || (ch >= 0x80 && ch <= 0xff))) return false;
        }
        return true;
    }

    /** 保守仅支持 IMF-fixdate，完整解析并回写相等以拒绝错星期、溢出及宽松格式。 */
    public static boolean isHttpDate(String value) {
        if (value == null || !value.matches("(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [0-9]{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) [0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2} GMT")) return false;
        java.text.SimpleDateFormat format = new java.text.SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", java.util.Locale.US);
        format.setLenient(false);
        format.setTimeZone(java.util.TimeZone.getTimeZone("GMT"));
        java.text.ParsePosition position = new java.text.ParsePosition(0);
        java.util.Date parsed = format.parse(value, position);
        return parsed != null && position.getIndex() == value.length() && value.equals(format.format(parsed));
    }

    public static String ifRangeValidator(String etag, String modified) {
        return isStrongEtag(etag) ? etag : isHttpDate(modified) ? modified : null;
    }

    public static boolean responseValidatorMatches(String etag, String modified, String responseEtag, String responseModified) {
        if (isStrongEtag(etag)) return isStrongEtag(responseEtag) && etag.equals(responseEtag);
        return isHttpDate(modified) && isHttpDate(responseModified) && modified.equals(responseModified);
    }

    public static boolean canRequeue(String status, boolean completedFileMissing) {
        return "PAUSED".equals(status) || "FAILED".equals(status) || "CANCELLED".equals(status)
                || ("COMPLETED".equals(status) && completedFileMissing);
    }
    public static String stoppedFailureStatus(String status) {
        if ("PAUSING".equals(status)) return "PAUSED";
        if ("CANCELLED".equals(status)) return "CANCELLED";
        return "FAILED";
    }
    public static boolean resolvedDuplicateWins(boolean currentHasTarget, boolean otherHasTarget, long currentCreated, String currentId, long otherCreated, String otherId) {
        return !currentHasTarget && (otherHasTarget || otherCreated < currentCreated || (otherCreated == currentCreated && otherId.compareTo(currentId) < 0));
    }
    public static boolean safeRecordedPath(java.io.File file, java.io.File parent) {
        try {
            return file.isAbsolute() && file.getAbsolutePath().equals(file.getCanonicalPath())
                    && !java.nio.file.Files.isSymbolicLink(file.toPath())
                    && parent.getCanonicalFile().equals(file.getParentFile().getCanonicalFile())
                    && (!file.exists() || file.isFile());
        } catch (java.io.IOException | SecurityException error) { return false; }
    }
    public static boolean acceptsGeneration(long expected, long actual, boolean removed) {
        return !removed && expected == actual;
    }
}
