<template>
  <AppDialog v-for="entry in appDialogs" :key="entry.dialog.key" :show="entry.show" :options="entry.dialog" :busy="entry.busy"
    @positive="runDialogAction(entry, 'positive', $event)"
    @negative="runDialogAction(entry, 'negative', $event)"
    @close="runDialogAction(entry, 'close')"
    @dismiss="entry.dialog.destroy()"
    @after-leave="removeDialog(entry)" />
</template>

<script setup lang="ts">
import AppDialog from "./AppDialog.vue";
import { appDialogs, removeDialog, runDialogAction } from "@/utils/appDialog";
</script>
