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
    public static boolean acceptsGeneration(long expected, long actual, boolean removed) {
        return !removed && expected == actual;
    }
}
