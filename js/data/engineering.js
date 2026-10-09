/* iOS 题宝库 · data/engineering.js:工程化与安全 */
'use strict';

QB.add({
  key: 'engineering', name: '工程化与安全', icon: 'cEng', tint: '#C9A227',
  desc: '包管理、签名、CI/CD、测试与数据安全',
}, [
  {
    t: 'CocoaPods、Carthage、SPM 的对比?现在新项目怎么选?',
    lv: 2, fq: 3, tags: ['SPM', 'CocoaPods', '包管理'],
    key: ['SPM:Apple 一等公民,Package.swift 单声明,增量编译最好', '新项目一律 SPM;CocoaPods 老项目维护即可,不新引'],
    a: `| | CocoaPods | Carthage | **SPM** |
|---|---|---|---|
| 思路 | 集中生成 Pods 工程 + xcconfig 编进 workspace | 只编译出 framework 你手动拖 | Apple 官方,集成进 Xcode 的依赖图 |
| 侵入性 | 高(改工程结构) | 最低 | 低(单 Package.swift + Xcode 集成) |
| 编译 | 每次全量(除非二进制插件) | 自己管理二进制 | **增量最好**,按模块图复用 |
| 私密/二进制 | 私仓成熟 | 弱 | 私仓 + XCFramework 标准 |

**SPM 关键认知**:

- \`Package.swift\` 声明产品(library/executable)与 target(源码 + 资源),依赖按语义版本/分支/commit 锁定在 \`Package.resolved\`
- **本地路径开发模式**:主工程编辑时把库以本地路径挂载,改完即编;发版再切回远端 tag
- **二进制目标**:\`.binaryTarget\` 接 XCFramework,大库编一次全员复用(编译提速一金)

**选型结论**:新工程/新模块一律 SPM;CocoaPods 老仓维护不新引;Carthage 基本退出历史舞台。`,
  },
  {
    t: '动态库和静态库的区别?对启动速度和包体积的影响?',
    lv: 2, fq: 3, tags: ['静态库', '动态库', '链接'],
    key: ['静态库链接进可执行文件,启动快但包大;动态库运行时加载,共享但拖 dyld', 'Apple 共享缓存里系统库最优;自研库建议静态或 Mergeable'],
    a: `**对比**:

| | 静态库(.a/.xcframework static) | 动态库(.dylib/.framework) |
|---|---|---|
| 链接时机 | **链接时**合并进主二进制 | **运行时**由 dyld 装载 |
| 包体积 | 打进每个使用它的进程(去重差) | 多进程共享一份 |
| 启动耗时 | 几乎零影响(已在主二进制) | **拖 dyld**:装载、rebase/bind、镜像注册 |
| 更新 | 必须重新链接整个 App | 系统库里 Apple 可独立更新(共享缓存) |
| dead strip | 链接期可删未用 | 装载后按库为单位 |

**经验法则(2026)**:

- 启动优化要求**自研动态库个数 ≤ 个位数**,合并或静态化
- 系统动态库(Swift runtime, UIKit)走 Apple Shared Cache,**不要**重复打包
- Xcode 15+ **Mergeable Libraries**:开发期动态(增量链接快),发布期自动静态化,两全

**题点**:动态库多 → pre-main 重(见启动优化);静态泛型膨胀 → 包体积膨胀(Swift 泛型特化)。取舍的指标从来都是"量着看"。`,
  },
  {
    t: 'iOS 代码签名的原理?描述文件起到什么作用?',
    lv: 3, fq: 2, tags: ['签名', 'Provisioning Profile', '证书'],
    key: ['证书=开发者公钥+Apple 签名;描述文件=证书+AppID+设备+entitlements 的装箱签名', '安装时系统链式校验:Apple → 证书 → 描述文件 → 应用包'],
    a: `**四要素**:

1. **开发者证书**:你的公钥 + 私钥,Apple CA 签发(证书内嵌 Apple 签名)
2. **App ID**:bundle id + 允许的能力(Push、Group、HealthKit)
3. **Entitlements**:声明的二进制能力(键链、沙盒、推送)
4. **Provisioning Profile**:**描述文件** = { 证书列表, AppID, 设备列表(调试型) , Entitlements },整体再由 Apple 签名一遍

**验证链**:设备安装 App 时,**先验 Apple 的签名** → 描述文件可信 → 再验**证书链到 Apple 根** → 最后拆包核对 AppID / 设备 / 能力与描述文件中声明一致 → 代码签名(digested Mach-O + 资源)校验。**任意一环断裂**,都装不上。

**类型**:

- Development:开发机调试,受 100 台设备额度约束
- Ad Hoc:小范围分发,预先注册设备
- App Store / TestFlight:由 Apple 后端统一签,不校验设备
- Enterprise:企业内部分发,描述文件不绑定设备,被滥用控制严格

**重签名**(运维工具):换证书/描述文件/\`entitlements\`,对机器码重新 codesign,常用于灰度/内部测试渠道或越狱设备重签,Apple 签名链决不允许"伪造新的企业证书签老 App" — 重签名不是绕过,而是换合法的签名身份。`,
  },
  {
    t: '你们的 CI/CD 流水线怎么搭?(Fastlane / Xcode Cloud / 自托管)',
    lv: 2, fq: 2, tags: ['CI/CD', 'Fastlane', 'Xcode Cloud'],
    key: ['MR 触发 → lint + 测试 → 构建签名 → 上传 TF → 符号归档 → 通知', '证书用 match/Firebase App Dist 管;产物与 commit 强关联'],
    a: `**典型链路**:

\`\`\`
MR 打开 → SwiftLint/SwiftFormat → 单测(并行分片) → 截图测试(关键页)
→ 合并入主干 → 定时/手动 Release → match 拉证书 → gym 打包
→ Pilot 上传 TestFlight / App Store → dSYM 归档符号服务器 → Slack/钉钉通知
\`\`\`

**选型**:

- **Fastlane 自托管**:灵活,可接本地 Mac 小集群(\`xcodebuild\` + lane),学习成本低;-match\` 证书仓库加密存储,解决"证书各机不一致"
- **Xcode Cloud**:Apple 原生,证书一键托管,与 App Store Connect 深度集成,适合中小团队;自定义脚本能扩展关键环节
- **GitHub Actions / GitLab CI**:macOS runner,编译缓存(ccache/derivedData 共享)要靠策略

**工程重点**:

- **产物可追溯**:每个包带 commit、构建号、环境(xcconfig),日志自动归档 dSYM
- **矩阵测试**:多机型多系统版本串行/并行,UI 测试在 Nightly 单独跑,别卡住 MR
- **密钥管理**:fastlane Match / CI 密钥柜,**绝不**提交证书进仓库
- **率控**:构建时间(冷启动/增量)与测试时长也纳入指标,CI 慢是生产力 bug`,
  },
  {
    t: '单元测试落地:Mock/Stub/Fake 的区别?怎么写异步测试?',
    lv: 2, fq: 3, tags: ['单元测试', '测试替身', 'XCTest'],
    key: ['Stub 返固定数据,Mock 带行为断言,Fake 简化替代实现', '可测三件套:协议化依赖 + 构造注入 + 不碰单例'],
    a: `**测试替身词汇表**:

- **Dummy**:传参占位,从不真使用
- **Stub**:返回**固定数据**(\`fetch() -> .success(fakeUser)\`)
- **Spy**:记录调用(次数、参数),供测试断言
- **Mock**:等于 Spy + 预设期望,**带行为断言**(\`verify.calledOnce\`)
- **Fake**:**可以真干活**的简化实现(内存实现的\`UserStore\`)

**异步测试**:

\`\`\`swift
// XCTest:回调式
let exp = expectation(description: "load")
api.load { _ in exp.fulfill() }
await fulfillment(of: [exp], timeout: 1)

// 现代:async 测试函数直接 await
@Test func fetchUser() async throws {
    let vm = ProfileVM(api: StubAPI(user: .mock))
    await vm.load()
    #expect(vm.state == .loaded(.mock))
}
\`\`\`

**可测性三件套**:协议化依赖、构造注入、不碰单例/Date()(\`Date.init\` 也要封装为 \`Date() -> Date\` 注入)。

**Swift Testing**(iOS 16 /Xcode 16 起):\`@Test\`、\`#expect\`、\`#require\`、参数化(\`arguments:\`)、Traits(\`.serialized\`、\`.timeLimit\`),比 XCTest 更简;**UI 测试、性能 measure 仍走 XCTest**。

**覆盖观**:ViewModel / UseCase / 转换器 / 边界条件优先;UI 主要靠 UI 测试与快照;80% 覆盖率是**团队约定**,不是信仰。`,
  },
  {
    t: 'UI 测试怎么写得稳?',
    lv: 2, fq: 2, tags: ['XCUITest', 'UI 测试', '稳定性'],
    key: ['accessibilityIdentifier 定位替代文案,waitForExistence 替代 sleep,Mock 隔离网络与动画', '用例间状态隔离 + 失败截图留证'],
    a: `**痛点三来源**:动画不确定、网络不确定、文案随语言变。**对策三板斧**:

1. **定位不用文案**:一律 \`accessibilityIdentifier\`(\`"login.submit"\`),本地化后依然稳
2. **等待不用 sleep**:\`waitForExistence(timeout:)\` / \`XCTNSPredicateExpectation\`,断言状态条件而不是死等
3. **环境固定**:
   - 启动参数注入 \`-UITestMode\` 与 mock server(\`URLProtocol\` 或本地 stub server)
   - 关动画:\`UIView.setAnimationsEnabled(false)\`
   - 固定用户、固定数据(fixture 预载)

**可维护**:

- **Page Object**:把页面元素与动作封装(\`LoginPage().submit()\`),用例读起来像剧本
- 用例间**状态隔离**(每用例清 keychain/重置容器)
- **失败证据**:失败自动 \`XCTAttachment\` 屏幕快照 + 录制,CI 归档
- 快照测试(SnapshotTesting)做像素级回归:关键页面 + 指定设备,**别乱上全量**`,
  },
  {
    t: 'API Key 等敏感信息怎么存?为什么不能硬编码?',
    lv: 2, fq: 3, tags: ['API Key', '安全', '密钥管理'],
    key: ['硬编码在 ipa 里可以被 strings/class-dump 抽出,形同明文', '正解:服务端代理 + 运行时获取 + Keychain 落盘'],
    a: `**错误的姿势**:

- 代码硬编码 \`let key = "sk_live_xxxx"\` → class-dump / strings 一拉全裸
- 放 \`Info.plist\` → 一样被解包明文
- "Base64 编码一下" → 只是编码不是加密,形同虚设

**正确的姿势(按强弱)**:

1. **服务端代理**(最优):客户端**根本不持有**密钥,调自家网关转发第三方,密钥留在服务端
2. **运行时获取**:先登录后从**受保护接口**下发短时凭证(AWS STS 思路),客户端只存**短寿凭证**
3. **Keychain 落盘**:必须留在设备上的长期凭证(AI key、第三方 SDK key)放 Keychain,\`kSecAttrAccessibleAfterFirstUnlock\` 控制
4. **构建注入**(\`.xcconfig\` + gitignore / CI 环境变量):开发期不提交,CI 注入,**但要承认**:任何"最终打包到 ipa 的字符串"都会被解包,这只能是**防开发泄漏,不防反编译**

**落地连接**:三方 SDK 的 key 放 Info.plist 是行业现实,缓释手段是**服务端签密 + 动态下发配置** + 发现泄漏**立刻轮换**。面试说出"分层的安全观":代码泄露 ≠ 资产生灾难,因为真正的钥匙在服务端。`,
  },
  {
    t: '隐私清单(Privacy Manifest)与 Required Reason API 是什么?',
    lv: 1, fq: 3, tags: ['隐私清单', 'PrivacyInfo', '上架'],
    key: ['PrivacyInfo.xcprivacy 必填:数据收集声明 + Required Reason API 使用原因', '三方 SDK 也要带;不合规影响上架审核'],
    a: `**Privacy Manifest(\`PrivacyInfo.xcprivacy\`)**:App 与每个**三方 SDK** 都要随包声明的 plist:

- **收集数据类型与用途**(联系方式、定位、诊断、IDFA…),对照 ATT 与隐私政策
- **Required Reason API**:被列为"敏感"的系统 API(文件时间戳、UserDefaults、磁盘空间、系统启动时间等),使用必须**报备原因**(防指纹收集)
- **追踪域名声明**

**落地注意**:

- 三方 SDK 升级时**别绕过它带的 manifest**,打自己包里照样上架合规
- **三方不重声明**:你自己用的 API 原因要在**自己 App** 清单里列
- 上架审核越来严,**没有清单 / 对不上** 会 ITMS-91053 拒绝

**关联**:ATT(\`ATTrackingManager\`) 是要才能收 IDFA;跟踪类 SDK 的初始化要等 ATT 授权窗口后;**新上架常态**:隐私清单 + 签名合规个体三方SDK 的双层审查。`,
  },
  {
    t: 'App 启动后,dyld 到底干了什么?("启动优化"的根)',
    lv: 3, fq: 3, tags: ['dyld', 'rebase', 'bind', '启动流程'],
    key: ['加载库 → rebase 内部指针 → bind 外部符号 → ObjC setup → initializers → main', '预启动闭包缓存(dyld 3/4)把可重复部分缓存下来'],
    a: `**dyld 的完整接力**(pre-main 阶段):

1. **加载可执行文件与依赖**:解析 Mach-O,**递归装载**声明的 \`LC_LOAD_DYLIB\`(系统库大多在 dyld shared cache)
2. **Rebase**:ASLR 让加载基址随机,镜像内**自己的指针**(NSData segment 中的函数表/对象引用)统一**加一个偏移**
3. **Bind**:镜像引用**别的镜像符号**的占位,查询符号表逐个填上真地址(懒绑定的走 stub 首次用时)
4. **ObjC setup**:\`map_images\` 回调 objc runtime 注册类、唯一化 selector、attach categories、初始化端
5. **Initializers**:C++ \`__attribute__((constructor))\`、ObjC \`+load\`,再进 \`main()\`

**dyld 3/4 的优化**:把第 2-4 步的可重复产物打包成**启动闭包(launch closure)**,下次启动**直接按闭包执行**,跳过库图计算与验证,冷启动显著变快。

**为什么这题是"启动优化的根"**:所有 pre-main 治理手段(动态库合并、+load 移除、二进制重排)= **减少这些阶段的工程量**;理解了链路,每个手法的意义就不言自明。`,
    deep: `**追问:rebase 和 bind 的区别?**

- rebase:镜像**内部**地址引用修正,公式很简单(真实基址−首选基址),但量大
- bind:镜像**调用外部符号**的解析,涉及符号查找,更贵;Apple 用 chained fixups 链式编码把它们压缩`,
  },
  {
    t: '开发期如何防止敏感数据在日志与边界泄漏?',
    lv: 2, fq: 2, tags: ['数据安全', '日志脱敏', '内存清零'],
    key: ['日志分级脱敏,敏感字段 os_log private;内存中敏感数据用完尽早清零', '防截屏/遮罩/isCaptured 也要入清单'],
    a: `**日志与泄漏源清单**:

- **日志**:分级 + 脱敏中间件(手机号 138****1234、身份证只留首尾),线上禁止明文落盘;\`os_log\` 敏感数字段用 \`%\{private\}\`(苹果系统在导出时星号)
- **屏幕**:进后台在 \`applicationWillResignActive\` 盖**遮罩层**(防多任务切换快照);敏感页面监听 \`UIScreen.capturedDidChangeNotification\` 提示或遮盖
- **键盘与输入**:密码统一 \`isSecureTextEntry = true\`(系统自带遮挡与输入缓存抑制)
- **内存**:敏感数据(token、明文密码)尽快用完即**内存清零**(\`memset_s\`),避免常驻 NSString 池
- **文件**:落盘数据\`NSFileProtectionComplete\`(锁屏后不可读),钥匙串同样分级

**配套合规**:\`PrivacyInfo.xcprivacy\` 与 SDK manifest 中声明到位,ATT / 精准定位权限的"请求时机在功能被使用而非启动即弹",合规与体验一体。`,
  },
  {
    t: 'Xcode 的编译流程是怎样的?Swift 与 OC 各走哪些阶段?',
    lv: 3, fq: 2, tags: ['编译流程', 'SIL', 'clang'],
    opt: ['Swift 和 OC 走完全相同的编译管线', 'Swift 经 AST → SIL → LLVM IR → 目标码,OC 走 clang 前端 → LLVM IR', 'Swift 不经过 LLVM', '链接发生在编译之前'],
    ans: 1,
    key: ['OC:预处理 → clang 词法/语法/语义 → LLVM IR → 优化 → 汇编 → 目标文件', 'Swift 多一层 SIL(做语义分析、泛型特化、ARC 优化)'],
    a: `**共同的后半程**:两者最终都生成 **LLVM IR** → LLVM 优化 → 汇编 → \`.o\` 目标文件 → **ld 链接**成 Mach-O → 生成 dSYM → 签名。

**OC 的前半程(clang)**:

\`\`\`
预处理(展开宏与 #import)→ 词法分析 → 语法分析(AST)
  → 静态分析 → CodeGen 生成 LLVM IR
\`\`\`

**Swift 的前半程(swiftc)** 多了关键一层 **SIL**:

\`\`\`
解析 → 语义分析(AST)→ SILGen(生成 raw SIL)
  → SIL 优化(泛型特化、ARC 优化、内联、去虚拟化)→ IRGen → LLVM IR
\`\`\`

**SIL 为什么重要**(这是区分度所在):Swift 很多特性只能在这一层做 —— **泛型特化**(为具体类型生成专用代码)、**ARC 优化**(消除多余的 retain/release 对)、**独占性检查**、**去虚拟化**。LLVM IR 层已经丢失了这些 Swift 语义信息。

**与编译速度的关系**(实用落点):

- Swift **类型推断**在语义分析阶段爆炸,复杂表达式是首要慢源 → 用 \`-Xfrontend -warn-long-expression-type-checking=500\` 揪出来
- **WMO(整模块优化)** 让 SIL 优化跨文件可见,运行更快但增量编译更慢;Debug 用 incremental,Release 用 WMO
- 模块化拆分能并行编译,是大工程提速的根本手段`,
  },
  {
    t: '什么是二进制重排?怎么拿到 order file?',
    lv: 3, fq: 2, tags: ['二进制重排', 'page fault', 'order file'],
    key: ['把启动路径上的函数排到相邻的页,减少启动时的缺页中断次数', '采集:Clang SanitizerCoverage 插桩记录函数首次调用顺序'],
    a: `**原理**:可执行文件按 **16KB 虚拟内存页**加载。启动要执行的函数如果散落在几十上百个页里,每碰一个没加载的页就是一次 **page fault**(还要走解密校验),冷启动时这个开销是毫秒级 × 几百次。

把**启动路径上的函数按调用顺序排到相邻的页**,page fault 次数可以降一个数量级。

**怎么采集 order file**:

1. Build Settings 打开 \`-fsanitize-coverage=func,trace-pc-guard\`
2. 实现 \`__sanitizer_cov_trace_pc_guard\`,在回调里用**原子入栈**记录函数地址(不能用锁,会严重拖慢且影响顺序)
3. 跑一遍完整启动流程,把记录的地址用 \`dladdr\` 还原成符号名
4. **逆序输出**(栈是后进先出)成 \`.order\` 文件,Swift 符号要保留 mangled 名
5. Build Settings 的 \`Order File\` 指向它,链接器按此排布

**验证效果**:用 Instruments 的 **System Trace** 看 \`File Backed Page In\` 次数,或直接测冷启动耗时(必须重启设备或杀进程后首次启动,否则页还在缓存里)。

**注意事项**:

- 采集必须覆盖**真实启动路径**,漏了分支等于没排
- order file 要**随版本更新**,代码大改后旧 order 会失效
- 只对**冷启动**有效,热启动页已在内存

**收益参考**:字节、美团公开分享过在低端机上省下 **100ms 以上**,是启动优化里性价比很高的一招。`,
  },
  {
    t: 'Debug 和 Release 构建有哪些实质差异?为什么有些 bug 只在 Release 出现?',
    lv: 2, fq: 2, tags: ['构建配置', '优化等级', 'Release bug'],
    key: ['Release 开 -O 优化、WMO、strip 符号、关断言;Debug 保留调试信息与 assert', 'Release-only bug 多来自:被优化掉的副作用、assert 被移除、未定义行为暴露'],
    a: `**主要差异**:

| | Debug | Release |
|---|---|---|
| Swift 优化 | \`-Onone\`(不优化,变量可见) | \`-O\` / \`-Osize\` + **WMO** |
| 断言 | \`assert\` / \`precondition\` 都生效 | \`assert\` **被移除**,\`precondition\` 保留 |
| 符号 | 完整保留 | **strip**,靠 dSYM 还原 |
| 内联 | 几乎不内联 | 大量内联、去虚拟化、泛型特化 |
| 其他 | 可能开 Sanitizer / Zombie | 关闭全部诊断 |

**为什么会有 Release-only bug**:

1. **副作用写在 assert 里**:\`assert(updateAndReturnTrue())\` 在 Release 下整句消失,逻辑静默改变 —— 断言里**永远不要放副作用**
2. **未定义行为被优化暴露**:野指针、越界、数据竞争在 -Onone 下"碰巧能跑",开优化后编译器按"UB 不会发生"的前提重排代码,直接崩
3. **依赖执行时序**:优化改变了 retain/release 的插入位置,\`unowned\` 引用的对象释放时机提前
4. **\`@inlinable\` / WMO 跨模块内联**后,原本的动态派发变成静态,swizzle 或 KVO 失效
5. **Swift 运行时检查**:整数溢出、数组越界在两种模式下都会 trap(这点 Swift 比 C 好),但**Unchecked 模式**(\`-Ounchecked\`)会关掉,别在生产用

**排查手段**:先用 **Release + 调试符号**(把 \`DEBUG_INFORMATION_FORMAT\` 设 dwarf-with-dsym 并临时关 strip)复现;再上 **Thread Sanitizer / Address Sanitizer**(它们在 Debug 下也能抓出 Release 才显形的 UB)。`,
  },
  {
    t: 'Swift Package Manager 的二进制依赖怎么接?XCFramework 解决了什么?',
    lv: 2, fq: 1, tags: ['SPM', 'XCFramework', '二进制依赖'],
    key: ['XCFramework 把多平台多架构的 framework 打成一个产物,取代 lipo 胖二进制', 'SPM 用 .binaryTarget 接入,可显著缩短编译时间'],
    a: `**XCFramework 解决的问题**:老的 fat framework 用 \`lipo\` 把多架构塞进一个二进制,但**模拟器 arm64 与真机 arm64 冲突**(Apple Silicon 之后尤其严重),没法共存。XCFramework 改成**按平台分目录**存放:

\`\`\`
MyKit.xcframework/
├── ios-arm64/MyKit.framework                    ← 真机
├── ios-arm64_x86_64-simulator/MyKit.framework   ← 模拟器(含 Apple Silicon)
└── Info.plist
\`\`\`

**SPM 接入**:

\`\`\`swift
.binaryTarget(
    name: "MediaCore",
    url: "https://cdn.you.com/MediaCore-1.4.0.xcframework.zip",
    checksum: "a3f2…"          // swift package compute-checksum 生成
)
// 本地调试时换成:
// .binaryTarget(name: "MediaCore", path: "../MediaCore.xcframework")
\`\`\`

**为什么值得做**(对你们这种带 C++ 媒体内核的工程收益最大):

- 大型 C++ 库编译一次几分钟,二进制化后**全组每次编译都省掉这段**
- CI 上构建产物可缓存复用
- 对外交付 SDK 时不暴露源码

**代价与注意**:

1. **checksum 必须对**,改了 zip 忘了更新 checksum 会直接报错(这是安全特性,不是 bug)
2. **调试体验下降**:断点进不去二进制内部 → 保留"源码模式"开关(本地 path 依赖),需要调试时切回去。很多团队会做一个「源码/二进制」一键切换的脚本
3. Swift 二进制需要 **Library Evolution**(\`BUILD_LIBRARY_FOR_DISTRIBUTION=YES\`)才能跨编译器版本使用,否则 Swift 版本一升就得重新出包`,
  },
]);
