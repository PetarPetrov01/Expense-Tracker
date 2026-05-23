import { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import type { ImportPreview } from '../lib/export/import-preview';
import { theme } from '../theme';

const CONFIRM_WORD = 'REPLACE';

export function ReplaceConfirmModal({ preview, onCancel, onConfirm }: {
  preview: ImportPreview;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const armed = typed === CONFIRM_WORD;
  const { doc } = preview;
  const expensesAfterReplace = doc.expenses.length;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
      >
        <View style={{ backgroundColor: theme.colors.bg, padding: theme.spacing.lg, gap: theme.spacing.md, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Text style={{ color: '#fca5a5', fontSize: 18, fontWeight: '600' }}>Replace ALL data?</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            This will wipe every expense and category currently on this device, then import {expensesAfterReplace} expenses from the file.
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            File: {doc.format} v{doc.formatVersion}, exported {new Date(doc.exportedAt).toLocaleString()}.
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: 14, marginTop: theme.spacing.sm }}>
            Type <Text style={{ fontWeight: '700' }}>{CONFIRM_WORD}</Text> to confirm:
          </Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={theme.colors.textMuted}
            style={{ backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, color: theme.colors.text }}
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
            <Pressable onPress={onCancel} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onConfirm} disabled={!armed} style={{
              flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md,
              backgroundColor: armed ? '#7f1d1d' : theme.colors.surface,
              alignItems: 'center', opacity: armed ? 1 : 0.5,
            }}>
              <Text style={{ color: armed ? '#fff' : theme.colors.textMuted, fontSize: 16, fontWeight: '600' }}>Replace</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
