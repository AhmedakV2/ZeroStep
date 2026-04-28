package com.ahmedv2.zerostep.step.util;

public final class FractionalIndexer {

    public static final double INITIAL_ORDER = 1024.0;
    public static final double APPEND_GAP = 1024.0;
    public static final double MIN_GAP = 0.000001;


    private FractionalIndexer() {}


    public static double compute(Double before, Double after) {
        if(before == null && after == null) {
            return INITIAL_ORDER;
        }
        if(before == null) {
            return after / 2.0;
        }
        if(after == null) {
            return  before + APPEND_GAP;
        }
        double gap = after - before;
        if(gap < MIN_GAP) {
            throw new IllegalStateException(
                    "Step order'lari cok yakin; rebalance gerekli (gap=" + gap + ")");
        }
        return before + gap / 2.0;
    }

    public static double appendAfter(Double currentMax) {
        return currentMax == null ? INITIAL_ORDER : currentMax + APPEND_GAP;
    }

}
