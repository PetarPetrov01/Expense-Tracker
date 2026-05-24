import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { format } from 'date-fns';
import { theme } from '../theme';
import { useSettings } from '../stores/settings';
import { ScopePickerSheet } from './ScopePickerSheet';

export function DateField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const weekStart = useSettings(s => s.weekStart);
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: theme.colors.surface, padding: theme.spacing.md,
          borderRadius: theme.radius.md,
        }}
      >
        <Text style={{ color: theme.colors.text, fontSize: 16 }}>{format(value, 'PPP')}</Text>
      </Pressable>
      <ScopePickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        onSelect={onChange}
        scope="day"
        anchor={value}
        weekStart={weekStart}
      />
    </View>
  );
}
