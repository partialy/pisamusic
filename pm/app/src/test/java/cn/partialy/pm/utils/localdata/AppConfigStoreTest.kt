package cn.partialy.pm.utils.localdata

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AppConfigStoreTest {

    private class InMemoryAppConfigStorage : AppConfigStorage {
        val map = linkedMapOf<String, AppConfigRecord>()
        var getCalls = 0

        override fun get(key: String): AppConfigRecord? {
            getCalls++
            return map[key]
        }

        override fun put(record: AppConfigRecord) {
            map[record.key] = record
        }

        override fun delete(key: String) {
            map.remove(key)
        }

        override fun listByNamespace(namespace: String): List<AppConfigRecord> =
            map.values.filter { it.namespace == namespace }.sortedBy { it.key }
    }

    @Test
    fun readWriteAndCacheAvoidsRepeatedStorageLookups() {
        val storage = InMemoryAppConfigStorage()
        var now = 1_000L
        val store = AppConfigStore(storage) { now }

        assertNull(store.read("lyric.effect_config"))
        assertNull(store.read("lyric.effect_config"))
        assertEquals(1, storage.getCalls)

        now = 2_000L
        val written = store.write("lyric.effect_config", """{"fps":90}""", namespace = "lyric", schemaVersion = 2)
        assertEquals(2_000L, written.updatedAt)
        assertEquals(2, written.schemaVersion)
        assertEquals("""{"fps":90}""", store.read("lyric.effect_config")?.valueJson)
        assertEquals(1, storage.getCalls)

        store.delete("lyric.effect_config")
        assertNull(store.read("lyric.effect_config"))
    }

    @Test
    fun migrateOnceImportsLegacyOnlyWhenMissing() {
        val storage = InMemoryAppConfigStorage()
        val store = AppConfigStore(storage) { 5_000L }
        var providerCalls = 0

        val migrated = store.migrateOnce("legacy.sample", namespace = "player", schemaVersion = 1) {
            providerCalls++
            """{"enabled":true}"""
        }
        assertEquals("""{"enabled":true}""", migrated?.valueJson)
        assertEquals(1, providerCalls)

        val second = store.migrateOnce("legacy.sample", namespace = "player", schemaVersion = 1) {
            providerCalls++
            """{"enabled":false}"""
        }
        assertEquals("""{"enabled":true}""", second?.valueJson)
        assertEquals(1, providerCalls)
    }

    @Test
    fun listByNamespaceReturnsScopedConfigs() {
        val storage = InMemoryAppConfigStorage()
        val store = AppConfigStore(storage) { 10L }
        store.write("lyric.b", "{}", namespace = "lyric")
        store.write("lyric.a", "{}", namespace = "lyric")
        store.write("player.a", "{}", namespace = "player")

        val lyricConfigs = store.listByNamespace("lyric")
        assertEquals(listOf("lyric.a", "lyric.b"), lyricConfigs.map { it.key })
    }
}
