/* iOS 题宝库 · data/architecture.js:架构与设计模式 */
'use strict';

QB.add({
  key: 'architecture', name: '架构与设计模式', icon: 'cArch', tint: '#7C4DDB',
  desc: 'SOLID、MVC/MVVM/TCA、组件化与依赖注入',
}, [
  {
    t: 'SOLID 五原则分别在 iOS 里怎么体现?',
    lv: 2, fq: 3, tags: ['SOLID', '原则'],
    opt: ['里氏替换要求子类必须重写父类所有方法', '依赖倒置:依赖协议抽象而非具体实现,便于注入 Mock 测试', '接口隔离建议用一个大协议统一管理', '开闭原则要求不能新增任何代码'],
    ans: 1,
    key: ['S 单一职责 / O 开闭 / L 里氏替换 / I 接口隔离 / D 依赖倒置', '每个原则给一句原理 + 一个 iOS 实例'],
    a: `**S 单一职责**:一个类型只负责一件事。Massive VC 的反面教材里,网络/数据源/导航全挤在 VC,拆出 Service/DataSource/Coordinator,每一类一个理由变化。

**O 开闭**:对扩展开放、对修改关闭。新增一种支付方式不改结算流程:新增 \`PaymentMethod\` 实现即可;Swift 用 **协议 + 策略** 替代"switch 越长越多"。

**L 里氏替换**:子类能替换父类不破坏契约。禁止在子类"override 后 \`fatalError()\` 阉割父类能力"(读者按父类接口调它会炸);继承语义弱时改用组合。

**I 接口隔离**:多个瘦协议优于胖协议。\`FeedLoading\`、\`PostLiking\`、\`CommentFetching\` 拆开,而不是一个 \`FeedViewModelProtocol\` 带 30 个方法,测试 mock 也轻松。

**D 依赖倒置**:依赖抽象不依赖具体。VM 依赖 \`APIFetching\` 协议,生产注 \`URLSessionClient\`,测试注 \`MockClient\`;硬编码 \`URLSession.shared\`/单例直取,就是不可替换的硬伤。`,
  },
  {
    t: '设计模式高频考点:iOS 里的活例子?',
    lv: 2, fq: 3, tags: ['设计模式', '实例'],
    key: ['响应链=责任链;TableView dataSource=适配器/委托;@ViewBuilder=建造者', '通知/Combine=观察者;NSProxy=代理;缓存代理访问=代理'],
    a: `**用"模式 → iOS 活例子"对答**:

| 模式 | iOS 里的例子 |
|------|-------------|
| **责任链** | 响应链(hitTest / nextResponder),事件沿链找处理者 |
| **观察者** | NotificationCenter / KVO / Combine \`@Published\` |
| **委托/适配器** | \`UITableViewDataSource\` 把你的数据适配给 list;包裹三方 SDK 成自家协议也是适配器 |
| **建造者** | \`NSAttributedString\` / \`URLRequest\` 组装 / SwiftUI \`@ViewBuilder\` |
| **策略** | 排序比较器、支付方式、缓存策略注入 |
| **装饰器** | 网络层叠"鉴权 → 缓存 → 日志 → 重试"洋葱(DataSource 包装装饰器) |
| **外观** | \`UIImagePickerController\` 把复杂的相机/相册封成一个 VC;启动引导器统一收 SDK 初始化 |
| **代理** | \`NSProxy\`(弱引用代理、懒加载门面)、NSCache 之于对象缓存 |
| **备忘录** | State Restoration、Codable 草稿快照 |
| **工厂/抽象工厂** | 路由按 URL 创建对应 VC;主题工厂一次产出整族组件 |

**考试法术**:明句 **"模式是场景驱动的,不是背概念"**,任意模式顺便说"我们项目里 X 用 Y 模式解决了 Z"。`,
  },
  {
    t: 'MVC 为什么会变 Massive View Controller?MVVM 到底解决了什么?',
    lv: 2, fq: 3, tags: ['MVC', 'MVVM', 'Massive VC'],
    opt: ['MVC 模式本身设计有缺陷无法使用', 'Apple MVC 中 VC 同时承担 View 与 Controller 职责,网络/数据源/导航全堆进来', 'MVVM 能消除所有样板代码', 'ViewModel 里可以 import UIKit'],
    ans: 1,
    key: ['Apple MVC 里 VC 既当 View 又当 Controller,职责全堆这里', 'MVVM 把状态与逻辑抽进 VM,View 只声明"长什么样",逻辑可脱离 UIKit 单测'],
    a: `**Apple MVC 的坍缩**:\`UIViewController\` 既是 View 生命周期持有者又是控制器,网络回调、数据源、格式化、导航、代理实现全向这里涌入,几千行常态。

**MVVM 的解法**:

- **ViewModel**:持有**页面状态**与**业务操作**,输出"渲染就绪"的显示模型(可观察)
- **View/VC**:声明式地把 VM 状态**绑定**到 UI(Combine/KVO/闭包),大多路径是"状态变 → 界面变"
- **收益**:VM **不 import UIKit**,可在纯逻辑层单测;视图层变薄,代码竞态点收敛

**VM 里放什么/不放什么**:

- 放:页面状态、命令(加载/刷新/提交)、数据变换(日期/货币格式)、输入校验
- 不放:UIKit 对象(UIColor/UIImage 换成自定义值类型)、导航决定(交给 Coordinator)、业务跨页共享状态(放更上层 Store)

**灵魂追问**:\`ViewModel 能 import UIKit 吗\` — **不能**,import 意味着能摸到 View,分层名存实亡,测试要起宿主,这是"VM 纯度"的暗考点。`,
  },
  {
    t: 'MVVM 中的数据绑定怎么做?(闭包 / KVO / Combine / @Observable 怎么选)',
    lv: 2, fq: 3, tags: ['数据绑定', 'MVVM', 'Combine'],
    opt: ['必须使用第三方响应式框架', '可用 @Observable、Combine、闭包或 KVO;原则是单向、可拆、只推变化', 'ViewModel 应直接持有 UIView 引用', '绑定不需要在视图消失时断开'],
    ans: 1,
    key: ['新项目:@Observable/Combine;历史包袱:闭包与 KVO;原则:绑定是单向、可拆、只报变化', '闭环表达:输入事件 → VM 改状态 → 状态流 → 刷新 UI'],
    a: `**四条路按新老排**:

1. **\`@Observable\`(iOS 17+,首选)**:VM 标 \`@Observable\`,视图读到哪个属性就订阅哪个,**模板最少**
2. **Combine \`@Published\`**:\`vm.$state.sink { render($0) }.store(in: &c)\`,UIKit 项目主力;记得 in store
3. **闭包回调**:\`vm.onStateChange = { [weak self] s in ... }\`,零依赖,小页面性价比极高
4. **KVO**:历史神兽,字符串 keypath + 类型弱,新代码不推荐

**绑定纪律**(写出 MVVM 的样子):

- **单向**:UI 不直接改 VM 状态,UI 发"事件/intent"(tap、input),\`VM 改状态 → 状态流 → UI\`
- **绑定可拆**:deinit/视图消失时断开,用 cancellable/token,别留悬空回调
- **只推变化**:属性级 or 差量 \`removeDuplicates\`,避免全量重渲染

**TCA 类框架**本质是把这个纪律变成范式:State → View → Action → Reducer → 新 State,纯函数可回放(见 TCA 题)。`,
  },
  {
    t: 'TCA 的核心概念是什么?适合什么项目?',
    lv: 3, fq: 2, tags: ['TCA', '单向数据流', 'Reducer'],
    key: ['State 值 + Action 枚举 + Reducer 纯函数 + Store + Effect(依赖注入)', '可回放、可测试;代价是样板多,适合中大型难维护状态机'],
    a: `**五概念**:

- **State**:页面**全部可变状态**的值类型快照(.struct)
- **Action**:所有"能发生的事"的枚举(用户行为 + 系统回调)
- **Reducer**:(state, action, environment) → 新 state + 副作用描述,**纯函数**
- **Store**:持有 State,接收 Action,驱动 Reducer,把时间偏移的能力留给自己
- **Effect/Dependencies**:副作用描述的可测封装,Hashable 的"取消令牌"管理异步任务

**世界观收益**:

- **可测试性**:每个 reducer 都能写单测:给 state,送 action,期望新 state 与 effect
- **可预测性**:状态只能从 action 一路变,**可回放**(debug 记录 action 序列)排错
- SwiftUI 契合度极高(值语义)

**代价**:样板代码(Boilerplate)与宏语法门槛;非关键页过重。Point-Free 用宏(\`@Reducer\`、\`@ObservableState\`)在 1.x 版本已大幅减样板,**中型以上、状态机硬**的 SDK/编辑器类产品收益最大。

**代际对话**:MVVM+Combine 是"约定俗成的纪律",TCA 是"范式化的纪律",混用时新模块上 TCA,老页面不必硬迁。`,
  },
  {
    t: 'Coordinator 模式解决什么问题?在 SwiftUI 里怎么落地?',
    lv: 2, fq: 2, tags: ['Coordinator', '导航', '路由'],
    key: ['把导航从 VC 抽离:VC 不 push,告诉 Coordinator 去哪', 'SwiftUI:Router/数据驱动 path,弱化 VC 概念'],
    a: `**解决什么**:

- VC 不再 \`push(DetailVC())\`:不直接创建对方,**互相不引用**
- 深链/AB 实验/流程编排(先 A 再 B 才 C)可以统一编排,不被导航栈的栈帧困住
- 同一 VC 可在不同流程复用(注册页既能用在 Onboarding 也能用在设置)

**UIKit 原型**:\`protocol Coordinator { func start() }\` 树形持有,AppCoordinator 管 TabCoordinator 管 FlowCoordinator,VC 通过协议或闭包\`event(to:)\` 上报 → Coordinator 决定 push/present/replace。

**SwiftUI 的版本**:由于声明式导航是**数据驱动**:

- \`NavigationStack(path:)\` 的 path 就是天然路由;配合 **Router 值对象** 管理 \`[Route]\`,深链=直接构建 path
- **modal/sheet** 用 enum 驱动(\`sheet(item:)\`),所有弹层在 VM/Router 层描述
- **协调器的精神**仍在:导航决策**不放视图**,放 Router;VM 收 UI 事件,告诉 Router 去哪里

**问"和 MVVM-C 什么关系"**:MVVM-C 就是 MVVM 加一层 Coordinator,导航由 C 管,VM 只生产状态与领域事件。`,
  },
  {
    t: 'VIPER / Clean Architecture 的大致结构?什么时候会用?',
    lv: 3, fq: 1, tags: ['VIPER', 'Clean Architecture'],
    key: ['Clean:依赖只指向内层(Entity ← UseCase ← Interface ← Framework),业务与技术细节解耦', '大型团队核心模块的试测性投资'],
    a: `**VIPER**:View / Interactor / Presenter / Entity / Router 五件套,职责粒度最细:Presenter 决定"显示什么文本",Interactor 跑业务,Entity 是纯数据,Router 管导航。收益是**可测性天花板**,代价是文件数量爆炸(一页 5+ 文件),小页面永远别上。

**Clean Architecture**(同心圆):

- 业务规则(Entity/UseCase)在**内**,框架(UI、DB、网络)在**外**
- **依赖规则:外层依赖内层,内层不知道外层**(UseCase 不知道 URLSession 和 SQLite 的存在,依赖抽象接口言)
- iOS 上通常落成:**视图 + MVVM(表现层)+ UseCase 领域服务 + Repository(数据层接口) + DataSource(网络/磁盘实现)**

**何时用**:硬核合规、超长生命周期、需要替换数据源/双端共用领域逻辑(配合 SPM/跨平台)的项目;初创期上来就 Clean,是将复杂税前置支付。

**话术重点**:"Clean 不是抽象越多越好,是**把变化锁进自己的层**" — 懂的面试官会接着问 DTO 与 domain model 映射边界。`,
  },
  {
    t: '组件化怎么做?跨模块调用有哪几种方案?',
    lv: 3, fq: 3, tags: ['组件化', '模块化', '路由'],
    opt: ['所有模块直接互相 import 即可', 'URL 路由、协议+服务注册、Target-Action 三种方案,配合接口下沉防循环依赖', '组件化必须使用 CocoaPods', '业务模块之间应直接引用彼此的实现类'],
    ans: 1,
    key: ['目标:独立编译/测试/发版;跨模块用 URL 路由 / 协议+注册 / Target-Action 解耦', '基础库分层防循环依赖,壳工程集成'],
    a: `**目标**:各业务模块**独立编译**(编译加速)、独立测试(低偶发)、独立发版(二进制交付)。

**跨模块调用三种方案**:

1. **URL 路由**:\`mh://order/detail?id=9\`,注册表 pattern → 工厂闭包;**优点**服务端可下发、解耦彻底;**缺点**弱类型(参数都是字符串/any)、编译期不查、跳错页面运行时才知
2. **协议 + 服务注册**(Protocol-Class):模块把"对外承诺"声明成协议放**接口层**,实现注册到服务表,消费方拿协议调用 — **强类型**、可 IDE 补全,是主场方案
3. **Target-Action / CTMediator**:runtime 动态调用维护成本最低的中间层,处理跨模块不依赖,缺点也是弱类型与字符串协议

**基础治理**:

- **接口下沉**:业务模块对外的协议/DTO 放到共享的 **Interface 层**,实现放**实现层**,调用方只依赖接口
- **防循环依赖**:依赖图约定 Core ← Feature ← App 外壳;接口层不依赖实现
- **资源与依赖**:包管理用 SPM 或 CocoaPods 私有索引,版本仲裁一套
- **壳工程 + 独立 Example 工程**并行,CI 上模块独立构建

**实战点位**:跨模块**同步数据**(登录态变化)用"接口层定义 NotificationKey / Combine Subject",不做直接引用。`,
  },
  {
    t: '模块间通信方案对比:Delegate / Notification / Closure / Combine?什么时候用?',
    lv: 2, fq: 3, tags: ['通信', 'Delegate', 'Notification'],
    opt: ['任何场景都应优先使用通知', 'delegate 一对一强约束,通知一对多广播,闭包就近回调,Combine 处理事件流', 'delegate 适合跨越 7 层传递', '跨页面数据同步应靠通知满天飞'],
    ans: 1,
    key: ['一对一强约束 delegate;一对多广播 Notification;就近回调闭包;响应式流 Combine', '语义匹配:回调必须有"返回值语义"用 delegate,事件用通知'],
    a: `| 方式 | 关系 | 强度 | 适用 |
|------|------|------|------|
| **Delegate** | 一对一,协议契约 | 强(编译期) | 数据源、需返回值、确认关系("\`X 提供\`对 \`Y 请求\`") |
| **Notification** | 一对多,弱类型 | 弱(userInfo) | 全局广播:登录态跳变、主题变化;用于模块间解耦 |
| **闭包** | 就近 | 强 | 一次性闭环(API 回调、弹窗选择) |
| **KVO** | 对象属性 | 弱 | 需要盯某属性(老项目) |
| **Combine** | 流 | 强 | 异步串流、多变换、跨层通知(sink 端在 VM) |

**用错的味道**:

- "delegate 链传 7 层" → 该走通知或共享 Store
- "通知满天飞没人知道谁发的" → 收敛到事件总线或合并进 State
- "VC 持 cell 的闭包引 self 成环" → 闭包也要注意 [weak self]

**架构性方向**:跨页面同一份数据**别通消息同步**,做**单一数据源 Repository/Store**,谁要读直接订阅同一份(见系统设计题),告别"通知同步世界"。`,
  },
  {
    t: '依赖注入怎么做?为什么它让代码可测?',
    lv: 2, fq: 3, tags: ['DI', '依赖注入', '可测试性'],
    opt: ['依赖注入必须使用第三方容器框架', '构造器注入为主,依赖协议而非具体类型,测试时注入 Mock', '单例比依赖注入更利于测试', '属性注入是唯一推荐的方式'],
    ans: 1,
    key: ['构造注入(首选)、属性注入、方法注入、容器(Environment/Swinject)', '测试时注入 Mock,生产注入真实实现;单例只当"默认参数"'],
    a: `**三种注法**:

1. **构造器注入**(强推):依赖显式必填,\`init(api: APIFetching, store: KeyValueStoring)\`,test 时给 \`MockAPI\`
2. **属性注入**(可选依赖):有默认实现时用,如 logger
3. **方法/参数注入**:单点替换
4. **容器/环境**:SwiftUI \`@Environment\`、Swinject/Factory/swift-dependencies,管理组装图

**为什么它让代码可测**:

- VM 只依赖**协议**,测试注入 \`MockAPI\` 返回固定数据/抛错,断言状态机、边界条件,无需起网络宿主
- 副作用(现在时间、UUID、随机数、文件落盘)**协议化**(\`Date() -> Date\`、\`UUIDGenerating\`),测试可控
- **单例可测化**:调用方**依赖协议**,单例以默认参数出现(\`init(api: APIFetching = .shared)\`),测试完全不碰单例,生产上路零成本

**服用提示**:注册表/容器也要"保留测试入口"(reset + override),\`@Environment\` 之外的混入要在 Preview/Tests 里能覆盖,写 preview 时给 Mock container。`,
  },
  {
    t: '单例的优缺点?什么时候合理?',
    lv: 1, fq: 3, tags: ['单例', 'Singleton'],
    opt: ['单例是反模式,任何场景都不应使用', '适合无业务状态的全局入口;缺点是隐藏依赖、难测试,可用协议+默认参数缓解', '单例天然线程安全无需处理', '单例适合存放业务状态'],
    ans: 1,
    key: ['合理:语义上全局唯一+无业务状态(Logger、配置门面)', '陷阱:隐藏依赖、耦合、测试难、共享状态成竞态源'],
    a: `**什么合理**:

- **入口语义上只能有一个**:Logger、埋点上报器、CrashReporter、配置门面、Keychain 门面
- 它们是**稳定的无业务状态基件**(不持有订单、用户这种业务状态,所有状态理应放进 Session/Repository)

**什么不合理**:

- 当"全局变量垃圾桶"(网络、缓存、UI 状态全塞进去),模块之间靠单例读状态,**调用关系不可逆推**

**代价清单**:

- **隐藏依赖**:类声明看不出它在用 IC.shared 还是 Analytics.shared,维护只能靠搜
- **测试**:无法替换为 Mock,测试互相摔状态
- **生命周期失控**:共享可变状态导致的多线程竞态,一调试一晚上

**可测化三件套**:

1. 单例**只作为"生产默认值"**:\`init(api: APIFetching = .shared)\`,调用方依赖协议
2. 有状态的提供 \`reset()\`
3. 测试**不接触**单例

**话术**:"单例不是设计出来的,是**抽离出来的**" — 我的新项目倾向不用,等到"这个东西必须一个"才让它从协议后面走出来。`,
  },
  {
    t: 'Codable 的原理?自定义解码处理脏数据?',
    lv: 2, fq: 3, tags: ['Codable', 'JSONDecoder', '容错'],
    opt: ['Codable 只能解析字段完全匹配的 JSON', '编译器合成 init(from:),可自定义 CodingKeys 与 init 处理脏数据与默认值', 'decodeIfPresent 会在字段缺失时抛错', 'Codable 不支持嵌套结构'],
    ans: 1,
    key: ['编译器合成 init(from: CodingKeys 映射)+ 容器解码;valueForKeyPath 的前身', '容错:decodeIfPresent + 默认值、宽容型容器、自定义 LossyDecodable'],
    a: `**原理**:协议 \`Decodable\` 要求 \`init(from: Decoder)\`,\`Encodable\` 要求 \`encode(to:)\`;编译器**自动合成**:遍历成员,按 \`CodingKeys\`(默认属性名)从 \`KeyedDecodingContainer\` 逐个 \`decode\`。

**自定义解码三场景**:

1. **key 重命名/嵌套**:自定义 CodingKeys,\`try container.decode(String.self, forKey: .displayName)\`,嵌套用 \`nestedContainer(keyedBy:forKey:)\`
2. **类型混杂**(某个字段可能数字也可能字符串):\`.decodeLossyString\` 宽容解析,或 \`try? decode(Int.self)\` 降级 \`try? decode(String.self)\`
3. **缺容/默认值**:用 \`decodeIfPresent\` + \`??\` 提供默认;**写 \`init(from:)\` 时给所有属性兜底**

**脏数据求生**:

\`\`\`swift
init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    id = try c.decode(Int.self, forKey: .id)
    title = (try? c.decode(String.self, forKey: .title)) ?? ""
    score = (try? c.decode(Double.self, forKey: .score)) ?? 0
}
\`\`\`

**进阶**:\`keyDecodingStrategy = .convertFromSnakeCase\`、自定义 \`DateDecodingStrategy\`、\`superDecoder\`、多态数组加 \`type\` 字段手工 case-by-case 解码。\n\n**与 NSCoding 对比**:类型安全、编译期合成、Swift 原生,**新项目默认 Codable**;NSCoding 的价值只在"对象图 + 兼容老归档"。`,
  },
  {
    t: 'JSON 解析性能怎么优化?数据量大时如何避免主线程卡顿?',
    lv: 3, fq: 2, tags: ['JSON 性能', '解析', '主线程'],
    key: ['原始数据级别优化:少层级、字段砍量;bulk 用流式解析', '解码放后台,模型按层级 lazy 生成;CryptoSwift/ZippyJSON 类加成'],
    a: `**输入侧**:

1. **协议裁剪**:只传需要的字段;大列表分页;Gzip/Protobuf 替代 JSON(带宽和解析双利)
2. **结构扁平**:嵌套少、数组别写对象套对象

**解析层**:

3. **后台解码**:批量解析放 \`Task.detached\` / 专用队列,**模型必须是 Sendable 值类型**;结果回发布者再入 VM
4. **流式解析**:大 JSON 用 \`JSONSerialization.jsonObject(with:stream)\`、流解析库(如 YYModel 思路/自研 scanner)逐步产出,内存峰值平
5. **快引擎**:\`ZippyJSON\`(simdjson 移植)、\`protobuf\` / \`flatbuffers\` 对热路径接口换二进制

**模型层**:

6. **懒物化**:列表先存"轻量数据索引",详情点击才 decode 详情对象
7. **缓存**:解析结果(以版本号/etag 为键)磁盘缓存,冷启动直接渲染上次的

**观测**:解析 + 主线程提交打点分开看,优化要量化(Instruments Time Profiler / os_signpost),目标**主线程解析 < 8ms**。`,
  },
  {
    t: '组件化里"资源与依赖管理"怎么做?',
    lv: 3, fq: 1, tags: ['组件化', 'SPM', 'CocoaPods', '资源'],
    key: ['资源:bundle 分离 + SwiftGen 类型安全;依赖:SPM 优先,二进制 XCFramework 提速', '注意公共层版本仲裁与循环依赖'],
    a: `**资源管理**:

- **图片/色板/字符串** 放到模块自己的 \`Bundle.module\`(SPM)或 \`.bundle\`,代码用 SwiftGen/R.swift 生成**类型安全常量**,杜绝字符串手工写
- **资产目录**用 Asset Catalog 的**命名空间**(\`Images/\` 前缀按模块),资产生成可用 \`Image("module/icon")\`
- 模块**国际化**归自己管理,壳工程只集成

**依赖管理**:

- **SPM 优先**(2026 标准):Package.swift 单声明,本地路径开发模式 + 远端 tag;编译因模块图而**增量极好**
- CocoaPods 私仓老项目保持维护即可,**不新引**
- **二进制化**预热:大库(音视频引擎、跨端内核)用 **XCFramework** 出成品,业务侧只依赖聚合接口,编译时间砍一半以上
- **版本仲裁**:一套中央依赖表(\`Package.resolved\` 或 Versions.xcconfig),**版本号与发布心跳**(版本即发,接口稳定后要降级难)

**防循环与混乱**:

- Core 层无业务;接口层(interface package)只放协议/DTO;Feature 层只依赖接口与 Core
- 定期 \`swift package dump-package\` 可视化依赖图,AI 工具/脚本检查循环`,
  },
]);
