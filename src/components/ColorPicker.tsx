import { useEffect, useState } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { theme } from '../theme';

const SWATCHES = ['#10b981','#3b82f6','#8b5cf6','#ec4899','#ef4444','#f59e0b','#eab308','#14b8a6','#06b6d4','#6b7280'];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => { setHexInput(value); }, [value]);

  function onHexChange(text: string) {
    setHexInput(text);
    const normalized = text.startsWith('#') ? text : `#${text}`;
    if (HEX_RE.test(normalized)) onChange(normalized.toLowerCase());
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {SWATCHES.map(c => (
          <Pressable key={c} onPress={() => onChange(c)} style={{
            width: 36, height: 36, borderRadius: 18, backgroundColor: c,
            borderWidth: value === c ? 3 : 0, borderColor: theme.colors.text,
          }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: value, borderWidth: 1, borderColor: theme.colors.border,
        }} />
        <TextInput
          value={hexInput}
          onChangeText={onHexChange}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={7}
          placeholder="#RRGGBB"
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1,
            backgroundColor: theme.colors.surface2,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.md,
            color: theme.colors.text,
            fontSize: 14,
          }}
        />
      </View>
    </View>
  );
}
