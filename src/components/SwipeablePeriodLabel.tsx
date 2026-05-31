import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedReaction, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { theme } from '../theme';
import { type Scope, type WeekStart, stepAnchorBy, formatScope } from '../lib/dates';

const SIDE = 5;
const N = SIDE * 2 + 1;
const SNAP_DURATION = 200;
const VELOCITY_TRIGGER = 350;
const THRESHOLD_FRACTION = 0.25;

export function SwipeablePeriodLabel({
  anchor,
  scope,
  weekStart,
  canPrev,
  canNext,
  onAnchorChange,
  onPress,
}: {
  anchor: Date;
  scope: Scope;
  weekStart: WeekStart;
  canPrev: boolean;
  canNext: boolean;
  onAnchorChange: (a: Date) => void;
  onPress: () => void;
}) {
  const [width, setWidth] = useState(0);
  const [baseAnchor, setBaseAnchor] = useState(anchor);

  const activeIdxSV = useSharedValue(SIDE);
  const tx = useSharedValue(0);

  // Mirror the UI-thread activeIdx to a JS-side ref so we can compare against
  // externally-driven anchor changes without racing.
  const activeIdxRef = useRef(SIDE);
  function syncActiveIdxRef(v: number) {
    activeIdxRef.current = v;
  }
  useAnimatedReaction(
    () => activeIdxSV.value,
    (v) => { runOnJS(syncActiveIdxRef)(v); },
  );

  // If parent's anchor changes for a reason other than our own swipe (e.g.
  // chevron buttons, Today, Custom apply), rebase the strip on it.
  useEffect(() => {
    const ourAnchor = stepAnchorBy(scope, baseAnchor, activeIdxRef.current - SIDE);
    if (ourAnchor.getTime() !== anchor.getTime()) {
      setBaseAnchor(anchor);
      activeIdxSV.value = SIDE;
      activeIdxRef.current = SIDE;
      tx.value = 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, scope]);

  // Static labels — only recomputed when baseAnchor / scope / weekStart change.
  // During a swipe commit, these do NOT change, so there is no race between
  // label re-render and translation.
  const labels = useMemo(
    () =>
      Array.from({ length: N }, (_, i) =>
        formatScope(scope, stepAnchorBy(scope, baseAnchor, i - SIDE), weekStart),
      ),
    [scope, baseAnchor, weekStart],
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * activeIdxSV.value + tx.value }],
  }));

  function commitAt(newIdx: number) {
    const newAnchor = stepAnchorBy(scope, baseAnchor, newIdx - SIDE);
    onAnchorChange(newAnchor);
  }

  const gesture = Gesture.Pan()
    .enabled(width > 0)
    .activeOffsetX([-15, 15])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      'worklet';
      let v = e.translationX;
      const idx = activeIdxSV.value;
      if (v > 0 && (!canPrev || idx === 0)) v = 0;
      if (v < 0 && (!canNext || idx === N - 1)) v = 0;
      tx.value = v;
    })
    .onEnd((e) => {
      'worklet';
      const threshold = width * THRESHOLD_FRACTION;
      const idx = activeIdxSV.value;
      const goPrev =
        canPrev && idx > 0 &&
        (tx.value > threshold || e.velocityX > VELOCITY_TRIGGER);
      const goNext =
        canNext && idx < N - 1 &&
        (tx.value < -threshold || e.velocityX < -VELOCITY_TRIGGER);

      if (goPrev) {
        const newIdx = idx - 1;
        activeIdxSV.value = newIdx;
        tx.value = tx.value - width;
        tx.value = withTiming(0, { duration: SNAP_DURATION });
        runOnJS(commitAt)(newIdx);
      } else if (goNext) {
        const newIdx = idx + 1;
        activeIdxSV.value = newIdx;
        tx.value = tx.value + width;
        tx.value = withTiming(0, { duration: SNAP_DURATION });
        runOnJS(commitAt)(newIdx);
      } else {
        tx.value = withTiming(0, { duration: SNAP_DURATION });
      }
    });

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        flex: 1,
        height: 36,
        overflow: 'hidden',
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.pill,
      }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            { flexDirection: 'row', width: Math.max(width * N, 0), height: '100%' },
            animStyle,
          ]}
        >
          {labels.map((label, i) => (
            <Pressable
              key={i}
              onPress={onPress}
              style={{ width, height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={labelText} numberOfLines={1}>{label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const labelText = {
  color: theme.colors.text,
  fontSize: 15,
  fontWeight: '600' as const,
};
