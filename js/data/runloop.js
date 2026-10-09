/* iOS 题宝库 · data/runloop.js:RunLoop */
'use strict';

QB.add({
  key: 'runloop', name: 'RunLoop', icon: 'cRunloop', tint: '#24B4C0',
  desc: '事件循环、Mode、Source 与经典应用',
}, [
  {
    t: 'RunLoop 是什么?它和线程是什么关系?',
    lv: 1, fq: 3, tags: ['RunLoop', '线程', '事件循环'],
    opt: ['一个线程可以有多个 RunLoop', 'RunLoop 与线程一一对应,主线程自动开启,子线程需手动运行', '子线程的 RunLoop 默认自动运行', 'RunLoop 空闲时会持续占用 CPU 轮询'],
    ans: 1,
    key: ['线程的事件循环:有事做事,无事内核态休眠', '与线程一一对应,主线程默认开,子线程要手动 run'],
    a: `**定义**:RunLoop 是**线程的事件循环**:一个"有任务就做事,没有任务就把线程挂到内核态休眠(mach_msg 等待),事件来了再唤醒"的循环。它解决了"线程怎么活下来又不空耗 CPU"的问题。

**与线程的关系**:

- **一一对应**:每个线程至多一个 RunLoop,通过全局字典映射;
- **主线程**的 RunLoop 由系统在 \`UIApplicationMain\` 内自动创建并启动,这就是 App 能"保持活着等事件"的本质
- **子线程**默认**没有**启动 RunLoop(对象惰性创建,真要常驻要 \`RunLoop.current.run()\` 并至少注册一个 source/timer/port,否则立即退出)

**为什么叫"运行循环"**:伪代码骨架:

\`\`\`
loop:
    通知 observer:timer/source0 到了 → 处理
    若有 source1(端口事件)→ 唤醒处理
    若无事 → 休眠(mach_msg_trap),等 timer/端口/外部唤醒
    若退出条件 → break
\`\`\`

**面试铺垫**:记住一句话:**App = 一个被 RunLoop 防腐的主线程**,所有 UI 刷新、触摸、Timer、autorelease 池维护都挂在它的事件节拍上。`,
  },
  {
    t: 'RunLoop 的 Mode 是什么?为什么滚动时 Timer 不触发?',
    lv: 2, fq: 3, tags: ['Mode', 'UITrackingRunLoopMode', 'NSTimer'],
    opt: ['Timer 默认注册在 CommonModes,滚动时不触发', '滚动时 RunLoop 切到 UITrackingRunLoopMode,Default Mode 的 Timer 暂停', 'Timer 与 RunLoop 没有关系', '滑动时 Timer 会被销毁重建'],
    ans: 1,
    key: ['Mode 是 source/timer/observer 的集合,一次只跑一个 Mode', 'UITracking 滚动时切换,common 打标签跨集'],
    a: `**Mode 是"事件源的分组"**:RunLoop 同一时间只在一个 Mode 下运行,只处理**注册在该 Mode 下**的 source / timer / observer;Mode 切换时,旧 Mode 的事件**暂停**,新 Mode 启动节拍。

**常见 Mode**:

- \`kCFRunLoopDefaultMode\`:默认,平时所在
- \`UITrackingRunLoopMode\`:滑动 UIScrollView 时切入,优先保证滚动丝滑
- \`kCFRunLoopCommonModes\`:不是真 Mode,是**一组 Mode 的标签**(默认含 Default + UITracking),把 source 注册成 common 就能在这两个 Mode 下都工作

**滑动时 Timer 失效的原因**:\`Timer.scheduledTimer\` 默认注册进 **default mode**;滚动时 runloop 切到 tracking mode,timer 的事件不再被处理,等滚动结束切回来才补发。

**两种修法**:

\`\`\`swift
RunLoop.main.add(timer, forMode: .common)   // 注册成 common
// 或:用 GCD timer(不走 runloop)
\`\`\`

**追问预备**:CADisplayLink 同样受 mode 约束,常在滚动里"停"的逐帧回调,也是同一层原因。`,
  },
  {
    t: 'RunLoop 的内部结构:Source0、Source1、Timer、Observer 各干什么?',
    lv: 3, fq: 2, tags: ['Source', 'Observer', 'CFRunLoop'],
    key: ['Source0 需手动发信号(App 内事件如 performSelector);Source1 内核端口驱动(触摸/系统事件)', 'Observer 监听 loop 状态变化,是卡顿监控的抓手'],
    a: `**四类事件源**:

- **Source0**:进程**内部**的事件,**需要手动触发**(\`CFRunLoopSourceSignal\` + wakeUp):如 \`performSelector(onThread:)\`、App 内部自定义事件
- **Source1**:基于 **mach port 的内核事件**,系统就绪自动唤醒:触摸事件、屏幕刷新(底层部分)、进程间通信
- **Timer**:基于时间的源(\`NSTimer\`、\`performSelector:afterDelay:\`),到点触发,受 mode 约束、有 tolerance 合并节能
- **Observer**:监听 RunLoop **自身状态切换**:\`Entry / BeforeTimers / BeforeSources / BeforeWaiting(休眠) / AfterWaiting(唤醒) / Exit\`,不处理业务事件,是**监控与系统任务挂靠点**

**主线程上系统挂了哪些自动任务**(面试加分项):

- \`BeforeWaiting\`:之前注册的 CATransaction **commit**(UI 刷新)、autoreleasepool pop + push
- \`Entry\`:autoreleasepool push
- 触摸、Timer、GCD 主队列、手势识别,都依赖这些节拍`,
  },
  {
    t: 'RunLoop 和 autoreleasepool 的关系?',
    lv: 3, fq: 3, tags: ['autoreleasepool', 'RunLoop Observer'],
    opt: ['两者没有关系', '主线程 RunLoop 注册了 observer:Entry 时 push,BeforeWaiting 时 pop 再 push', 'autoreleasepool 每次方法调用都会创建', '子线程不开 RunLoop 也会自动清理 autorelease 对象'],
    ans: 1,
    key: ['主线程 runloop 注册了两个 observer:Entry push、BeforeWaiting pop+push', '子线程无 runloop 时要手动包池,否则临时对象堆到 runloop 空闲也不释放'],
    a: `**主子线程的差异**源于 runloop。系统在主线程 RunLoop 上注册了两个 Observer:

- \`kCFRunLoopEntry\`(进入循环时):**push** 一个新的 autorelease pool
- \`kCFRunLoopBeforeWaiting\`(休眠前):**pop 旧 pool 并 push 新 pool**,于是每一轮循环生成的 autorelease 对象都在进入等待前被 release
- \`kCFRunLoopExit\`:最后 pop

**这就解释了三件事**:

1. 为什么主线程平时不写 \`@autoreleasepool\` 也安全(系统每圈都给你换新的)
2. 为什么高压后台线程(尤其不开 runloop 的)大循环里要**手动包池**(见内存管理那一题)
3. 为什么"页面跳转了内存还没降"通常是**runloop 暂时很忙还没到 BeforeWaiting**,等它闲下来就会回落

**配合追问**:pop 是把池内对象逐个 release,**不是**立即 free;真正 free 看引用计数动态归零,别被"池清 == 对象没了"的句法骗到。`,
  },
  {
    t: '怎么利用 RunLoop 做卡顿监控?说一套可上线的方案。',
    lv: 3, fq: 3, tags: ['卡顿监控', 'RunLoop Observer', 'APM'],
    opt: ['统计 CPU 使用率超过阈值即判定卡顿', '用 observer 监听主线程状态切换,超时未完成一轮即判卡顿并 dump 堆栈', '只能用 CADisplayLink 统计帧率', 'RunLoop 无法用于卡顿监控'],
    ans: 1,
    key: ['Observer 盯主线程状态切换,超时未进入 BeforeWaiting 判卡顿', '子线程超时 dump 主线程堆栈 → 聚合归因'],
    a: `**核心思路**:主线程每轮 RunLoop 循环正常应该是毫秒级;如果 \`BeforeSources → AfterWaiting → BeforeWaiting\` 的状态切换**超过阈值没走完**,说明主线程被长任务占住。

\`\`\`objc
CFRunLoopObserverCallBack: 记录当前状态 + 时间戳(DispatchSemaphoreSignal)
子线程看门狗:循环 wait 信号 2s,超时 → backtrace 主线程堆栈写日志
\`\`\`

**落地清单**:

1. 阈值分档:单次 "hang" > 250ms(MetricKit 同口径)、连续掉帧 > 3 帧(约 50ms)记为卡顿
2. **堆栈聚合归因**:卡顿堆栈按"调用链顶部业务符号"分桶,线上才有可读的火焰图(参考 Bugly/Matrix 思路)
3. 采样策略:启动后前 N 次/滑动中提高采样,空闲降频,收控制开关
4. **不要**在主线程写文件/网络上报(dump 后落盘走子线程)

**联动**:MetricKit \`MXHangDiagnostic\` 是系统级验收基准,自研与它数据可对比校准。`,
  },
  {
    t: 'performSelector:afterDelay: 在子线程为什么不执行?',
    lv: 2, fq: 2, tags: ['performSelector', 'afterDelay', 'runloop'],
    key: ['afterDelay 走 runloop timer,子线程默认没启动 runloop', 'GCD asyncAfter / Timer 是更稳的替代'],
    a: `**原因**:\`performSelector:withObject:afterDelay:\` 是把调用包成一个 **timer 注册到当前线程的 RunLoop**;子线程虽然惰性**创建**了 RunLoop 对象,但**从未 run**,timer 永远等不到触发时机。

**解决方案**:

1. 子线程里先启动 runloop:\`RunLoop.current.run()\`(注意至少挂个 port / source,否则立即退出)
2. 或者用 **GCD 的 \`asyncAfter\`**(不依赖 runloop),这是绝大多数场景更简单的选择:

\`\`\`swift
DispatchQueue.global().asyncAfter(deadline: .now() + 1.0) { work() }
\`\`\`

**加分纠偏**:别误以为"子线程开了 runloop 就万事大吉"。常驻线程会持续消耗调度资源,能 GCD 解决的事件不要用常驻线程,线程保活这种 AFNetworking 2 时代的模式,在新工程里更多是历史考点而非最佳实践。`,
  },
  {
    t: 'CADisplayLink 和 Timer 的区别?',
    lv: 2, fq: 2, tags: ['CADisplayLink', 'Timer', '帧同步'],
    key: ['DisplayLink 与屏幕 VSync 对齐,适合做帧动画;Timer 按 runloop 节拍,不保证帧对齐', 'iOS 15+ 用 preferredFrameRateRange 适配 ProMotion'],
    a: `| | Timer | CADisplayLink |
|---|---|---|
| 触发依据 | runloop 到点 | **屏幕刷新信号(VSync)** |
| 精度 | 有容差,可能被合并(tolerance) | 帧级对齐,卡点准 |
| 暂停 | 滚动时受 mode 影响 | 同样受 mode 影响 |
| 典型用途 | 业务定时、轮询 | 逐帧动画、自绘进度、FPS 统计 |

**ProMotion 注意点**(120Hz 屏):

- 用 \`preferredFramesPerSecond\`(iOS 15 前)或 \`preferredFrameRateRange\`(iOS 15+)声明期望帧率,不给值系统可能按 60Hz 回调
- RefreshRate 是自适应的,不是恒 120Hz,统计 FPS 要按实际 timestamps 算,不能写死 16.7ms

**进阶问**:DisplayLink 每次回调依然跑在 **runloop 上**,回调里做超重的活照样掉帧;真正瓶颈在它的触发**相位**精致而工作量预算仍只有一帧(60Hz 16.7ms / 120Hz 8.3ms)。`,
  },
  {
    t: 'RunLoop 与 UI 刷新的关系?修改了 view 属性为什么不会立即显示?',
    lv: 3, fq: 2, tags: ['UI 刷新', 'CATransaction', 'beforeWaiting'],
    key: ['视图更新先在 CATransaction 攒着,runloop 休眠前一次性 commit 给渲染服务', 'setNeedsLayout 打脏标记,下一循环统一布局'],
    a: `**刷新链路**:

1. 修改 view/layer 属性 → 记录到当前 **CATransaction**(隐式事务),并给链路上的 layer **打脏标记**(\`setNeedsLayout\` / \`setNeedsDisplay\`)
2. 事务**并不立即提交**,等到本次 RunLoop 循环 **BeforeWaiting**(休眠前),\`CATransaction.commit\` 被 observer 触发
3. commit 阶段:依次 布局(layoutSublayers)→ 显示(display/drawRect)→ 打包给 render server(backboardd)做 GPU 合成
4. 下一帧 VSync,结果上屏

**由此推出的行为**:

- 同一轮循环里再改属性,是**追加到当前事务**,不会 "发了两次"
- **要立即应用**:\`layoutIfNeeded()\` 强制同步布局;动画里改约束的标准写法就是 \`UIView.animate { view.layoutIfNeeded() }\`
- **为什么 main runloop 忙会"界面没动"**:循环不到 BeforeWaiting,commit 被推迟,你观测到的"界面未刷新"也正是卡顿监控的理论依据

**SwiftUI 对照**:状态变化是标脏视图节点,在下一次 render pass 统一 diff 提交,节拍理念一模一样。`,
  },
  {
    t: '如何利用 RunLoop 做线程保活?(AFNetworking 的常驻线程思路)',
    lv: 3, fq: 2, tags: ['线程保活', 'performSelector', 'AFNetworking 2'],
    key: ['子线程 run() + 挂个空 port 防退出,事件驱动复用线程', '权衡:GCD/并发框架优先,常驻线程是特定需求方案'],
    a: `**做法**(AFNetworking 2.x 的网络线程):

\`\`\`objc
NSThread *thread = [[NSThread alloc] initWithBlock:^{
    [NSRunLoop currentRunLoop].addPort(NSMachPort.port, forMode: NSDefaultRunLoopMode); // 占位防退出
    [NSRunLoop currentRunLoop].run];
}];
[thread start];

// 往这个线程派活:
[self performSelector:@selector(work) onThread:thread withObject:nil waitUntilDone:NO];
\`\`\`

要点:**有源才不退出**(空 mach port 就是占位源),之后 performSelector(source0)驱动,一条线程承担所有串联的回调,**避免了每个请求一个线程**。

**2026 视角**:

- 需要"长久、严格串行"的收件箱,**actor** 是更现代的方案(编译期保证,无手动 runloop 管理)
- 常驻线程仍有出场的场景:对外暴露同步 API 的旧 OC 组件、蓝牙/串口等事件源驱动协议栈
- 注意退出路径:\`CFRunLoopStop\` 才能结束,否则线程常驻到进程死

**答题姿态**:给出方案的同时给出**何时不该用**,比对 GCD/Operation/actor,是高分答案的样子。`,
  },
  {
    t: 'RunLoop 的 observer 能监听哪些状态?系统自己用它做了什么?',
    lv: 3, fq: 2, tags: ['Observer', 'CFRunLoopActivity'],
    opt: ['observer 只能监听进入和退出两个状态', 'observer 可监听 Entry/BeforeTimers/BeforeSources/BeforeWaiting/AfterWaiting/Exit 六个时机', 'observer 会拦截事件', 'observer 只能在子线程注册'],
    ans: 1,
    key: ['六个时机:Entry / BeforeTimers / BeforeSources / BeforeWaiting / AfterWaiting / Exit', '系统用它做 autoreleasepool 与 CATransaction 提交'],
    a: `**六个可监听时机**(\`CFRunLoopActivity\`):

\`\`\`
kCFRunLoopEntry          即将进入循环
kCFRunLoopBeforeTimers   即将处理 Timer
kCFRunLoopBeforeSources  即将处理 Source
kCFRunLoopBeforeWaiting  即将休眠  ← 最有用的一个
kCFRunLoopAfterWaiting   刚被唤醒
kCFRunLoopExit           即将退出循环
\`\`\`

**系统自己挂了什么**(答出来很加分):

- **AutoreleasePool**:\`Entry\` 时 push,\`BeforeWaiting\` 时 pop 旧的再 push 新的,\`Exit\` 时 pop。这就是主线程不用手写 pool 的原因
- **CATransaction 提交**:\`BeforeWaiting\` 时把本轮攒的 UI 改动统一提交给 Render Server,即"UI 不会立即刷新"的底层机制
- **手势识别**:识别状态的更新也挂在这一轮节拍上

**自己能用它做什么**:

1. **卡顿监控**:盯状态切换耗时(见卡顿监控题)
2. **闲时任务**:注册 \`BeforeWaiting\` 观察者,把预加载、日志落盘这类不紧急的活排到主线程真正空闲时做
3. **性能打点**:测量一轮循环的真实耗时

\`\`\`swift
let observer = CFRunLoopObserverCreateWithHandler(nil, CFRunLoopActivity.beforeWaiting.rawValue, true, 0) { _, _ in
    idleTaskQueue.runNextIfAny()     // 主线程空了才干活
}
CFRunLoopAddObserver(CFRunLoopGetMain(), observer, .commonModes)
\`\`\``,
  },
  {
    t: 'source0 和 source1 到底差在哪?为什么触摸事件是 source1?',
    lv: 3, fq: 2, tags: ['Source0', 'Source1', 'mach port'],
    key: ['source0 是 App 内部事件,需手动 signal + wakeUp;source1 由内核 mach port 驱动,能主动唤醒休眠的 RunLoop', '触摸由系统进程经 port 送来,所以是 source1'],
    a: `**本质差异在"谁能把休眠的 RunLoop 叫醒"**:

| | Source0 | Source1 |
|---|---|---|
| 驱动方 | App 自己 | **内核 mach port** |
| 能否唤醒休眠的 RunLoop | **不能**,要配合 \`CFRunLoopWakeUp\` | **能**,port 有消息内核直接唤醒 |
| 典型场景 | \`performSelector:onThread:\`、App 内自定义事件 | 触摸事件、屏幕刷新信号、进程间通信 |

**为什么触摸是 source1**:触摸由 **SpringBoard / backboardd** 采集,通过 **mach port 跨进程**发给你的 App。App 此时多半正在 \`mach_msg\` 休眠,只有 port 消息能把它从内核态唤醒 —— source0 做不到这件事。

**完整链路**(经典追问):

\`\`\`
硬件触摸 → IOKit 封装 IOHIDEvent → backboardd
  → mach port 发给 App 进程 → 唤醒 RunLoop(source1)
  → source1 回调把事件包装成 UIEvent
  → 触发 source0 → UIApplication.sendEvent → hitTest 找到响应视图
\`\`\`

注意最后那步:**source1 收到后通常再触发一个 source0 来做实际分发**,所以在 Instruments 里看到的用户代码栈往往挂在 source0 上。`,
  },
  {
    t: 'CFRunLoopStop 和让线程自然退出有什么区别?常驻线程怎么优雅收场?',
    lv: 3, fq: 1, tags: ['线程退出', 'CFRunLoopStop'],
    key: ['run() 无条件循环,只能靠 CFRunLoopStop 或移除全部源退出', '优雅收场:标志位 + stop + 等待线程真正结束'],
    a: `**三种"结束"的差别**:

- **\`RunLoop.current.run()\`**:无条件死循环,**永远不返回**(内部反复调 runMode)。这也是常驻线程能活着的原因
- **\`run(mode:before:)\`**:跑一轮(或到超时)就返回,可以在 \`while (!shouldExit)\` 里手动驱动 —— **这是最容易优雅退出的写法**
- **\`CFRunLoopStop(runLoop)\`**:强制让当前 \`runMode\` 立即返回,配合标志位就能跳出循环

**优雅收场的标准写法**:

\`\`\`swift
final class KeepAliveThread {
    private var shouldExit = false
    private var thread: Thread?

    func start() {
        thread = Thread { [weak self] in
            let rl = RunLoop.current
            rl.add(Port(), forMode: .default)          // 占位源,防止立刻退出
            while !(self?.shouldExit ?? true) {
                rl.run(mode: .default, before: .distantFuture)   // 可控地跑一轮
            }
        }
        thread?.start()
    }

    func stop() {
        shouldExit = true
        // 必须把它"叫醒",否则它还在 distantFuture 上睡着
        perform(#selector(noop), on: thread!, with: nil, waitUntilDone: false)
    }
    @objc private func noop() {}
}
\`\`\`

**两个必踩的坑**:

1. **只设标志位不唤醒** → 线程还在休眠,永远看不到标志位,进程退出前一直活着
2. **在别的线程调 \`CFRunLoopStop\`** → 作用于目标 runloop 是可以的,但要确保拿到的是**目标线程的** runloop 对象,不是当前线程的

**现代替代**:这类需求在 Swift 并发里就是一个持有 \`Task\` 的 actor,\`task.cancel()\` 即收场 —— 不再需要手工管理线程生命周期。`,
  },
  {
    t: '主线程卡住时,RunLoop 处于什么状态?怎么区分"卡顿"和"死锁"?',
    lv: 3, fq: 2, tags: ['卡顿诊断', '死锁', 'RunLoop 状态'],
    key: ['卡顿:停在 BeforeSources/AfterWaiting 之间,栈里是业务代码', '死锁:停在等锁/等信号量的系统调用,栈顶是 psynch_mutexwait 之类'],
    a: `**两者在 RunLoop 视角的表现不同**:

| | 卡顿(busy) | 死锁 / 阻塞(blocked) |
|---|---|---|
| RunLoop 状态 | 停在 \`AfterWaiting → BeforeWaiting\` 之间,**一轮走不完** | 同样走不完,但 |
| 主线程栈顶 | **业务代码**(布局、解码、JSON、正则) | \`__psynch_mutexwait\` / \`semaphore_wait_trap\` / \`__ulock_wait\` |
| CPU 占用 | **高**(在真算) | **接近 0**(在等) |
| 结局 | 卡一下会恢复 | 永不恢复,最后被 Watchdog 杀(0x8badf00d) |

**诊断方法**:子线程看门狗发现主线程超时后,**dump 主线程栈**,看栈顶:

- 栈顶是自己的业务函数 + CPU 高 → **性能问题**,去优化算法/异步化
- 栈顶是 \`wait\` 系列系统调用 + CPU 低 → **等锁或等信号量**,往下翻栈找是谁在持锁(经典:主线程 \`semaphore.wait()\` 等一个永远不会 signal 的网络回调)
- 栈顶在 \`mach_msg_trap\` 且状态是 \`BeforeWaiting\` → **正常休眠**,不是卡顿,别误报

**最后一条是自研卡顿监控最容易出的 bug**:把"正常空闲休眠"当成卡顿上报,线上数据全是噪音。判定时必须排除 \`BeforeWaiting\` 这个合法的长时间状态。`,
  },
]);
