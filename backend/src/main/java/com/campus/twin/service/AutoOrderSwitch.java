package com.campus.twin.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 自动补单总开关（运行时可切换，<b>默认关闭</b>）。
 *
 * <p>为什么需要它：{@code AutoOrderScheduler} 每 30 秒自动生成订单并派单，
 * 实测约 <b>1,100 单/天</b>。这在录屏、端到端联调、或只想静看地图时都是干扰 ——
 * 订单列表会一直刷新、无人机一直在飞、业务数据无感增长。
 *
 * <p>设计取舍：
 * <ul>
 *   <li><b>只控"自动生成"</b>，不碰手动建单、自动派单、飞行动画 —— 否则配送闭环演示就做不了了；</li>
 *   <li><b>不持久化</b>：状态存在内存里，重启后端即回到配置的默认值（{@code false}），
 *       符合"默认关闭、要用才开"的预期；</li>
 *   <li>{@code generated} 记录"本次开启以来生成了多少单"，关闭即清零 ——
 *       给前端横幅一个可见的"代价"，避免开着忘了让数据悄悄涨。</li>
 * </ul>
 *
 * <p>初始值可由 {@code campus.auto-order.enabled}（环境变量 {@code CAMPUS_AUTO_ORDER_ENABLED}）
 * 覆盖，与 {@code campus.cleanup.enabled} 的既有风格一致。
 */
@Slf4j
@Component
public class AutoOrderSwitch {

    /** 配置文件中的初始值（默认 false） */
    @Value("${campus.auto-order.enabled:false}")
    private boolean enabledByConfig;

    private final AtomicBoolean enabled = new AtomicBoolean(false);

    /** 本次开启以来自动生成的订单数 */
    private final AtomicLong generated = new AtomicLong(0);

    @PostConstruct
    void init() {
        enabled.set(enabledByConfig);
        log.info("自动补单开关初始状态: {}（配置 campus.auto-order.enabled={}）",
                enabled.get() ? "开启" : "关闭", enabledByConfig);
    }

    public boolean isEnabled() {
        return enabled.get();
    }

    public long getGenerated() {
        return generated.get();
    }

    /** 调度器每成功生成一单调用一次 */
    public void recordGenerated() {
        generated.incrementAndGet();
    }

    /**
     * 切换开关。<b>状态变化时把计数归零</b>：
     * 开启后从 0 起算（横幅显示"本次开启以来"的量），关闭后不留残值。
     * 重复设置为同一状态时不归零 —— 否则前端重发一次 PUT 就会把计数清掉。
     *
     * @return 切换后的状态
     */
    public synchronized boolean switchTo(boolean target) {
        boolean changed = enabled.getAndSet(target) != target;
        if (changed) {
            generated.set(0);
            log.info("自动补单开关被切换为: {}", target ? "开启" : "关闭");
        }
        return enabled.get();
    }
}
