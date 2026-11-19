package cn.partialy.pm.network.config

import cn.partialy.pm.model.AndroidStartupData
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 冷启动聚合快照内存暂存：由 [SplashActivity] 写入，[MainStartupCoordinator] 消费即清。
 */
@Singleton
class StartupSnapshotStore @Inject constructor() {

    private val pending = AtomicReference<AndroidStartupData?>(null)

    fun save(data: AndroidStartupData) {
        pending.set(data)
    }

    fun consume(): AndroidStartupData? = pending.getAndSet(null)

    fun clear() {
        pending.set(null)
    }
}
