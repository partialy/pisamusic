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
