import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { exportToShareSheet, copyRawDatabase } from '../../src/lib/export/export-share';
import { pickAndParseImport } from '../../src/lib/export/import-parse';
import { computeImportPreview, type ImportPreview } from '../../src/lib/export/import-preview';
import { applyMergeImport, applyReplaceImport } from '../../src/lib/export/import-apply';
import { ImportPreviewModal } from '../../src/components/ImportPreviewModal';
import { ReplaceConfirmModal } from '../../src/components/ReplaceConfirmModal';
import { theme } from '../../src/theme';

type PendingImport = { mode: 'merge' | 'replace'; preview: ImportPreview };

export default function DataScreen() {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    catch (e) { Alert.alert('Error', (e as Error).message); }
    finally { setBusy(false); }
  }

  async function onExport() {
    await withBusy(async () => { await exportToShareSheet(); });
  }

  async function onImport(mode: 'merge' | 'replace') {
    await withBusy(async () => {
      const pick = await pickAndParseImport();
      if (pick.kind === 'cancelled') return;
      if (pick.kind === 'error') { Alert.alert('Import error', pick.message); return; }
      const preview = await computeImportPreview(pick.doc);
      setPending({ mode, preview });
    });
  }

  async function onConfirmImport() {
    if (!pending) return;
    const { mode, preview } = pending;
    setPending(null);
    await withBusy(async () => {
      if (mode === 'merge') {
        const r = await applyMergeImport(preview.doc);
        Alert.alert('Import complete', `${r.inserted} added, ${r.skipped} skipped.`);
      } else {
        const r = await applyReplaceImport(preview.doc);
        Alert.alert('Replace complete', `Wiped ${r.wiped.expenses} expenses, ${r.wiped.categories} categories. Added ${r.inserted}.`);
      }
    });
  }

  async function onCopyDb() {
    await withBusy(async () => { await copyRawDatabase(); });
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <ActionRow icon="export" label="Export to JSON" onPress={onExport} disabled={busy} />
      <ActionRow icon="import" label="Import from JSON (merge)" onPress={() => onImport('merge')} disabled={busy} />
      <ActionRow icon="alert-circle" label="Replace from JSON" destructive onPress={() => onImport('replace')} disabled={busy} />
      <ActionRow icon="database-export" label="Copy raw database file" onPress={onCopyDb} disabled={busy} />
      {busy && <ActivityIndicator style={{ marginTop: theme.spacing.lg }} color={theme.colors.primary} />}

      {pending?.mode === 'merge' && (
        <ImportPreviewModal
          preview={pending.preview}
          onCancel={() => setPending(null)}
          onConfirm={onConfirmImport}
        />
      )}
      {pending?.mode === 'replace' && (
        <ReplaceConfirmModal
          preview={pending.preview}
          onCancel={() => setPending(null)}
          onConfirm={onConfirmImport}
        />
      )}
    </View>
  );
}

function ActionRow({ icon, label, onPress, disabled, destructive }: {
  icon: string; label: string; onPress: () => void; disabled?: boolean; destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{
      flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
      padding: theme.spacing.md,
      backgroundColor: destructive ? '#7f1d1d' : theme.colors.surface,
      borderRadius: theme.radius.md,
      opacity: disabled ? 0.5 : 1,
    }}>
      <MaterialCommunityIcons name={icon as never} size={24} color={destructive ? '#fee2e2' : theme.colors.text} />
      <Text style={{ flex: 1, color: destructive ? '#fee2e2' : theme.colors.text, fontSize: 16 }}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color={destructive ? '#fecaca' : theme.colors.textMuted} />
    </Pressable>
  );
}
