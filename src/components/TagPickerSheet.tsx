import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { listTags } from '../repositories/tags';
import type { Tag } from '../db/schema';
import { theme } from '../theme';

const SLIDE_DISTANCE = 600;
const FADE_DURATION = 200;
const SLIDE_DURATION = 260;

export function TagPickerSheet({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (t: Tag) => void;
}) {
  const [items, setItems] = useState<Tag[]>([]);
  const [shouldRender, setShouldRender] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => { if (visible) listTags().then(setItems); }, [visible]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: FADE_DURATION,  useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: SLIDE_DURATION, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0,              duration: FADE_DURATION,  useNativeDriver: true }),
        Animated.timing(translateY, { toValue: SLIDE_DISTANCE, duration: SLIDE_DURATION, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setShouldRender(false); });
    }
  }, [visible, opacity, translateY]);

  if (!shouldRender) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity }]}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.lg,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: '70%',
        transform: [{ translateY }],
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, marginBottom: theme.spacing.md }}>Choose tag</Text>
        {items.length === 0 ? (
          <Text style={{ color: theme.colors.textMuted, paddingVertical: theme.spacing.md }}>No tags yet.</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(t) => String(t.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onSelect(item); onClose(); }}
                style={{ paddingVertical: theme.spacing.md }}
              >
                <Text style={{ color: theme.colors.text, fontSize: 16 }} numberOfLines={1}>{item.name}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
          />
        )}
      </Animated.View>
    </Modal>
  );
}
