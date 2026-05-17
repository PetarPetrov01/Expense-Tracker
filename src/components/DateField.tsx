import { useState } from 'react';
import { Pressable, Text, View, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { theme } from '../theme';

export function DateField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(true)} style={{
        backgroundColor: theme.colors.surface, padding: theme.spacing.md,
        borderRadius: theme.radius.md,
      }}>
        <Text style={{ color: theme.colors.text, fontSize: 16 }}>{format(value, 'PPP')}</Text>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setOpen(Platform.OS === 'ios');
            if (d) onChange(d);
          }}
        />
      )}
    </View>
  );
}
