import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, Text, Pressable, FlatList, InteractionManager, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { listCategories } from '../repositories/categories';
import type { Category } from '../db/schema';
import { CategoryIcon } from './CategoryIcon';
import { theme } from '../theme';

const SLIDE_DISTANCE = 600;
const FADE_DURATION = 200;
const SLIDE_DURATION = 260;

export function CategoryPickerSheet({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (c: Category) => void;
}) {
  const [items, setItems] = useState<Category[]>([]);
  const [shouldRender, setShouldRender] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => { if (visible) listCategories().then(setItems); }, [visible]);

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

  function openManage() {
    onClose();
    InteractionManager.runAfterInteractions(() => router.push('/category'));
  }

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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
          <Text style={{ color: theme.colors.text, fontSize: 18 }}>Choose category</Text>
          <Pressable onPress={openManage} hitSlop={8}>
            <Text style={{ color: theme.colors.primary, fontSize: 14 }}>Manage</Text>
          </Pressable>
        </View>
        <FlatList
          data={items}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => { onSelect(item); onClose(); }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.md, gap: theme.spacing.md }}
            >
              <CategoryIcon icon={item.icon} color={item.color} size={44} />
              <Text style={{ color: theme.colors.text, fontSize: 16, flex: 1 }} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.colors.border }} />}
        />
      </Animated.View>
    </Modal>
  );
}
