import { Modal, View, Text, Pressable, ScrollView } from 'react-native';
import type { ImportPreview } from '../lib/export/import-preview';
import { theme } from '../theme';

export function ImportPreviewModal({ preview, onCancel, onConfirm }: {
  preview: ImportPreview;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { doc, expensesToInsert, expensesToSkip, categoriesNew, categoriesMatchedByName, expensesUnknownCategory } = preview;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: theme.colors.bg, padding: theme.spacing.lg, gap: theme.spacing.md, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>Import preview</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
            File: {doc.format} v{doc.formatVersion}, exported {new Date(doc.exportedAt).toLocaleString()}, currency {doc.currency}
          </Text>
          <ScrollView style={{ maxHeight: 200 }}>
            <Row label="Expenses to add" value={String(expensesToInsert)} />
            <Row label="Duplicates to skip" value={String(expensesToSkip)} muted />
            <Row label="New categories" value={String(categoriesNew.length)} />
            <Row label="Matched local categories (by name)" value={String(categoriesMatchedByName.length)} muted />
            {expensesUnknownCategory > 0 && (
              <Row label="Expenses with unknown category (will use 'Imported (unknown)')" value={String(expensesUnknownCategory)} warning />
            )}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
            <Pressable onPress={onCancel} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text, fontSize: 16 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={{ flex: 1, padding: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, muted, warning }: { label: string; value: string; muted?: boolean; warning?: boolean }) {
  const color = warning ? '#fbbf24' : muted ? theme.colors.textMuted : theme.colors.text;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color, fontSize: 14, flex: 1 }}>{label}</Text>
      <Text style={{ color, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
