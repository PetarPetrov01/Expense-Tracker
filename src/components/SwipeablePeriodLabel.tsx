import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';

const SNAP_DURATION = 200;
const VELOCITY_TRIGGER = 350;
const THRESHOLD_FRACTION = 0.25;

export function SwipeablePeriodLabel({
  prevLabel,
  currLabel,
  nextLabel,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPress,
}: {
  prevLabel: string;
  currLabel: string;
  nextLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPress: () => void;
}) {
  const [width, setWidth] = useState(0);
  const tx = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + tx.value }],
  }));

  function commitPrev() {
    onPrev();
    tx.value = 0;
  }
  function commitNext() {
    onNext();
    tx.value = 0;
  }

  const gesture = Gesture.Pan()
    .enabled(width > 0)
    .activeOffsetX([-15, 15])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      'worklet';
      let v = e.translationX;
      if (v > 0 && !canPrev) v = 0;
      if (v < 0 && !canNext) v = 0;
      tx.value = v;
    })
    .onEnd((e) => {
      'worklet';
      const threshold = width * THRESHOLD_FRACTION;
      if (canPrev && (tx.value > threshold || e.velocityX > VELOCITY_TRIGGER)) {
        tx.value = withTiming(width, { duration: SNAP_DURATION }, (finished) => {
          if (finished) runOnJS(commitPrev)();
        });
      } else if (canNext && (tx.value < -threshold || e.velocityX < -VELOCITY_TRIGGER)) {
        tx.value = withTiming(-width, { duration: SNAP_DURATION }, (finished) => {
          if (finished) runOnJS(commitNext)();
        });
      } else {
        tx.value = withTiming(0, { duration: SNAP_DURATION });
      }
    });

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flex: 1, height: 36, overflow: 'hidden' }}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View style={[
          { flexDirection: 'row', width: width * 3, height: '100%' },
          animStyle,
        ]}>
          <View style={cell(width)}>
            <Text style={labelText} numberOfLines={1}>{prevLabel}</Text>
          </View>
          <Pressable onPress={onPress} style={[cell(width), { flexDirection: 'row', gap: 4 }]}>
            <Text style={labelText} numberOfLines={1}>{currLabel}</Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.text} />
          </Pressable>
          <View style={cell(width)}>
            <Text style={labelText} numberOfLines={1}>{nextLabel}</Text>
          </View>
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

function cell(w: number) {
  return {
    width: w,
    height: '100%' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}
