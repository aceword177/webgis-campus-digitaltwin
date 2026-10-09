package com.campus.twin.config;

import com.campus.twin.mapper.SystemMapper;
import com.campus.twin.service.DroneService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 启动时数据清理：修正历史脏数据。
 *
 * <p><b>默认关闭</b>，需显式开启：{@code campus.cleanup.enabled=true}
 * （见 {@code application.yml}）。
 *
 * <p>为什么默认关闭：本类会**改写业务数据**。此前每次启动都无条件执行，
 * 且存在两个破坏性问题——把未送达订单直接改判为 delivered（伪造送达时间，
 * 污染统计）、覆写用户填写的 remark 备注（不可恢复的数据丢失）。
 * 现在改为：
 * <ol>
 *   <li>默认不执行，由配置开关显式开启；</li>
 *   <li>整体包在一个事务里——此前是 4 条独立自动提交 UPDATE + 1 次 service 调用，
 *       中途失败会留下"改了一半"的状态，而调用方只记了一条 WARN；</li>
 *   <li>失败记 ERROR 而非 WARN，不再静默。</li>
 * </ol>
 *
 * <p>清理内容（注意区分"状态归位"与"伪造事实"）：
 * <ol>
 *   <li>分配超过 1 天仍未送达的 delivering 订单 → cancelled（作废，<b>不伪造送达</b>）</li>
 *   <li>分配超过 1 天仍停留在 assigned 的订单 → cancelled（释放无人机）</li>
 *   <li>已送达订单的航线状态 → completed（避免仍以 flying 显示在地图上）</li>
 *   <li>无配送中订单但状态为 delivering 的无人机 → idle</li>
 *   <li>空闲无人机归位食堂待命（距食堂过远时挪回）</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "campus.cleanup.enabled", havingValue = "true")
public class DataCleanupRunner implements ApplicationRunner {

    private final SystemMapper systemMapper;
    private final DroneService droneService;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // 不在此处 catch：异常必须向上抛出，事务拦截器才会回滚，
        // 否则"改了一半"的状态会被提交。清理失败属于部署期问题，
        // 应当让启动流程明确报错，而不是记一条日志后继续。
        int staleOrders = systemMapper.completeStaleOrders();
        int staleAssigned = systemMapper.completeStaleAssignedOrders();
        int staleRoutes = systemMapper.completeStaleRoutes();
        int staleDrones = systemMapper.resetStaleDrones();
        droneService.repositionIdleDronesToCanteen();
        log.info("启动数据清理完成: 历史配送中订单作废 {} 条, 历史未起飞订单作废 {} 条, "
                        + "航线状态同步 {} 条, 无人机状态修正 {} 架, 空闲无人机已归位食堂",
                staleOrders, staleAssigned, staleRoutes, staleDrones);
    }
}
