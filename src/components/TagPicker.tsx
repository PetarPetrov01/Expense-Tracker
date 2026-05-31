import { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Tag } from '../db/schema';
import { listTopTagsByUsage, getOrCreateTag } from '../repositories/tags';
import { theme } from '../theme';

export function TagPicker({
  selectedTagId,
  onChange,
  onAddFocus,
}: {
  selectedTagId: number | null;
  onChange: (tagId: number | null) => void;
  onAddFocus?: () => void;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    listTopTagsByUsage({ sinceDays: 3650, limit: 100 }).then(setTags);
  }, []);

  // selected-first, otherwise preserve the usage ordering from the query.
  const ordered = [...tags].sort((a, b) => {
    const aSel = a.id === selectedTagId ? 0 : 1;
    const bSel = b.id === selectedTagId ? 0 : 1;
    return aSel - bSel;
  });

  async function submitNew() {
    const tag = await getOrCreateTag(draft).catch(() => null);
    setDraft('');
    setAdding(false);
    if (!tag) return;
    setTags(prev => (prev.some(t => t.id === tag.id) ? prev : [tag, ...prev]));
    onChange(tag.id);
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Tag (optional)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: theme.spacing.sm }}
      >
        {ordered.map(t => {
          const selected = t.id === selectedTagId;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(selected ? null : t.id)}
              style={pillStyle(selected)}
            >
              <Text style={{ color: selected ? '#fff' : theme.colors.text }}>{t.name}</Text>
            </Pressable>
          );
        })}

        <Pressable onPress={() => setAdding(a => !a)} style={pillStyle(false)}>
          <MaterialCommunityIcons name="plus" size={16} color={theme.colors.text} />
          <Text style={{ color: theme.colors.text, marginLeft: 4 }}>Add tag</Text>
        </Pressable>
      </ScrollView>

      {adding && (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submitNew}
          onBlur={submitNew}
          onFocus={onAddFocus}
          autoFocus
          returnKeyType="done"
          placeholder="New tag name"
          placeholderTextColor={theme.colors.textMuted}
          style={{
            backgroundColor: theme.colors.surface,
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
          }}
        />
      )}
    </View>
  );
}

function pillStyle(selected: boolean) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: selected ? theme.colors.primary : theme.colors.border,
    backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
  };
}
