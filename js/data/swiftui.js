/* iOS 题宝库 · data/swiftui.js:SwiftUI */
'use strict';

QB.add({
  key: 'swiftui', name: 'SwiftUI', icon: 'cSwiftui', tint: '#17977F',
  desc: '声明式、状态体系、Identity 与性能',
}, [
  {
    t: '@State / @Binding / @StateObject / @ObservedObject / @EnvironmentObject 的区别?',
    lv: 1, fq: 3, tags: ['@State', '@StateObject', '数据流'],
    opt: ['@ObservedObject 应作为 VM 的创建者持有', '@StateObject 由本视图创建并持有,@ObservedObject 只订阅外部传入的对象', '@State 适合存放大型引用类型模型', '@EnvironmentObject 只能在根视图使用'],
    ans: 1,
    key: ['State 私有值;Binding 读引;StateObject 本视图创建持 VM;ObservedObject 只订阅不持有;EnvironmentObject 祖先注入', 'VM 的"出生地"用 StateObject,传参进入用 ObservedObject'],
    a: `| 包装器 | 数据归属 | 典型用途 |
|---|---|---|
| \`@State\` | **本视图私有**(值类型) | 开关、输入框文本,跟着 identity 走 |
| \`@Binding\` | 别人的状态,这里是**引用** | 子视图读/写父级 \`@State\`(弹窗开关) |
| \`@StateObject\` | **本视图创建并持有** 的 VM | ViewModel 的"出生地",identity 内只建一次 |
| \`@ObservedObject\` | 外部传入的 VM(不持有) | 订阅已有对象,父视图重建时 VM 也在 |
| \`@EnvironmentObject\` | 祖先注入的共享对象 | 登录态、主题,跨层级传播 |
| \`@Environment\` | 只读环境值 | dismiss、locale、sizeClass |

**经典坑与答法**:

- 在 View init 里写 \`StateObject(wrappedValue: VM())\` **不会每次重建 VM**(StateObject 只取**第一次**的 wrappedValue),但**构造表达式每次都会运行**,重活要放 VM 的懒点或工厂
- **错用 \`@ObservedObject\` 当出生地**:父层 body 重建时,新的 VM 被反复创建,状态丢失
- **@State 在 init 赋值**要用 \`_x = State(initialValue:)\`(操作底层存储),并且注意只在初始 identity 生效,动态换值应改传参/onChange 驱动`,
  },
  {
    t: '什么是视图的 Identity?if/else 和 opacity 切换对状态的影响?',
    lv: 3, fq: 3, tags: ['Identity', '结构标识', 'SwiftUI 原理'],
    key: ['结构标识=类型+在树里的位置;显式标识=.id() 覆盖', 'if/else 换显隐会换 identity → 状态重置;opacity 不变'],
    a: `**Identity 是 SwiftUI 的"这个视图还是不是同一个视图"的判定**:

- **结构标识(structural identity)**:视图类型 + 在视图树里的路径位置,编译期 \`@ViewBuilder\` 生成的 \`TupleView/_ConditionalContent\` 决定
- **显式标识(explicit identity)**:\`.id(xxx)\` 显式给值,\`ForEach(id:)\` 的 id 也属此类

**由此引出的硬结论**:

1. **\`if/else\` 返回不同分支 → identity 不同 → SwiftUI 销毁旧视图状态、创建新的**(\`@State\` 清空,动画重置)
2. **\`opacity(0)\` / \`hidden()\`**只是视觉换层,**identity 不变**,状态保留
3. **List 行 id 不稳定**(用索引/新对象):每次刷新 identity 全变,触发整页重建与状态错乱
4. \`.id(newValue)\` 手动换 identity 可以**强制重建**视图(换文档时清掉编辑态)

**面试话术**:SwiftUI 的 diff 与动画都是 identity 驱动:同 identity 的变化做插值,不同 identity 的变化做替换。讲性能/讲状态丢失/讲动画为什么抽搐,都离不开这个词。`,
    opt: ['if/else 切分支能保留 @State', 'opacity 从 1 到 0 会销毁视图状态', '同位置同类视图 identity 稳定,状态保留', '.id() 与性能无关'],
    ans: 2,
  },
  {
    t: 'SwiftUI 的 View 为什么是 struct?body 什么时候被重新计算?',
    lv: 2, fq: 3, tags: ['struct View', 'body 重算', 'Attribute Graph'],
    opt: ['struct 让 View 可以被继承复用', 'View 是值类型的界面描述快照,框架 diff 新旧描述树后只提交差异', 'body 每次重算都会重建所有子视图的状态', 'body 被频繁调用一定意味着性能问题'],
    ans: 1,
    key: ['值类型描述体,渲染引擎拿新旧描述树 diff,而非直接改 UI', '任何依赖的可观察输入变化 → 标脏 → 下一轮 render pass 重算 body'],
    a: `**为什么是 struct**:View 本质是**对界面的一次性描述快照**,值类型带来:轻量创建/复制无幂等管理成本、无共享状态、没有继承带来的不可预测,配合 identity 的 diff,框架只需对比"新描述"和"旧描述"就知道要改什么。

**body 何时重算**:

1. 视图**直接依赖**的状态变化:\`@State\` 写入、\`@ObservedObject/@StateObject\` 的 \`objectWillChange\`、\`@Observable\` 读取过的属性变化、\`@EnvironmentObject\` 发通知、\`@Binding\` 来源通步
2. **父视图 body 重算**(参数变化)传导到子视图;Equatable 的视图结构体一致时被剪枝
3. **环境值**变化(主题、sizeClass、locale)或 Preview 热重载

**底层描述**:依赖追踪 + Attribute Graph(属性图)把 body 求值做成**惰性且可缓存**的图,变化沿图传播,最小化重算面。

**性能纠偏**:**body 会被频繁重算**这件事本身不卡,**卡住的是重算里做了重活**(构建深树、排序/解析/编码)。把计算移到 VM 一次性做、视图拆小、依赖变窄(见性能优化题)。`,
  },
  {
    t: '@Observable(iOS 17)和 ObservableObject 有什么本质差异?',
    lv: 2, fq: 3, tags: ['@Observable', 'Observation', '精准刷新'],
    opt: ['两者刷新粒度完全相同', '@Observable 是属性级依赖追踪,只有被读取的属性变化才触发重算', '@Observable 仍需要 @Published 标注', 'ObservableObject 的刷新更精准'],
    ans: 1,
    key: ['@Published 对象级通知,任何属性变全树依赖都重算;@Observable 属性级追踪,只看用到的', '用宏展开实现,不再有 ObservableObject 协议束缚'],
    a: `**痛点**:ObservableObject + @Published 的粒度是**整个对象**:VM 里任一 @Published 属性变化,**所有订阅该 VM 的视图** body 都重算,哪怕它们只读 name 而你改的是 unreadCount。大 VM + 大列表的场景,掉帧就是这么来的。

**\`@Observable\`(iOS 17,宏)**:

- **属性级依赖追踪**:View body **读了哪个属性,就订阅哪个**,无关属性变化不再触发;同一个 VM 的全局修改,只有读到那个字段的视图刷新
- **写法简化**:不再需要 \`ObservableObject + @Published\`,直接 \`@Observable class VM { var name = "" }\`
- **配合新包装器**:在视图里 \`@State\` 持有,"借用"用 \`@Bindable\`(生成 Binding),注入用 \`@Environment(VM.self)\`

\`\`\`swift
@Observable final class FeedModel {
    var items: [Item] = []
    var unread = 0
}
struct FeedView: View {
    @State private var model = FeedModel()
    var body: some View { List(model.items) { ... } }   // 只依赖 items
}
\`\`\`

**连带收益**:不再要求 ViewModel 是 class final 细节、UIKit 也开始接 Observation(iOS 26 起 \`updateProperties()\` 自动追踪);\`withObservationTracking\` 是命令式观察的逃生口。`,
  },
  {
    t: '@StateObject 和 @ObservedObject 的本质区别?错误用法会有什么后果?',
    lv: 2, fq: 3, tags: ['@StateObject', '@ObservedObject', '生命周期'],
    opt: ['两者完全等价,只是语法糖不同', '@ObservedObject 创建并持有所属的 VM', '把 VM 出生地写成 @ObservedObject,父视图重算会导致 VM 被重建、状态丢失', '@StateObject 不能出现在子视图里'],
    ans: 2,
    key: ['StateObject 由 SwiftUI 管理存储,identity 内只建一次;ObservedObject 只是订阅,归属权在外部', '出生地用 ObservedObject → 父视图刷新 → VM 被重建 → 状态丢失'],
    a: `**规则一句话**:\`@StateObject\` 是"我创建并持有",\`@ObservedObject\` 是"别人给我我订阅"。

**错误用范与后果**:

\`\`\`swift
struct ParentView: View {
    @ObservedObject var vm = FeedViewModel()   // 错:ObservedObject 当出生地
    var body: some View { ... }
}
// 父视图因任何原因 body 重算 → 重新执行 init → **新的 VM** 被创建,
// @ObservedObject 不会保住旧的,正在编辑/加载的状态全部重置
\`\`\`

**正确搭配**:

- **创建者**这一层:\`@StateObject\`(SwiftUI 的存储系统保证 identity 内唯一)
- **传递下去**:\`@ObservedObject\`(子视图订阅),再由子视图决定是否再往下传还是 \`@EnvironmentObject\`

**iOS 17+ 的对应**:用 \`@State\` 持有 \`@Observable\` VM(创建者),用普通属性传递(订阅者),@Bindable 只在需要双向绑定的子视图里出现。

**连带**:\`@Published\` 触发的是整个 \`objectWillChange\`,无关刷新;@Observable 属性级,解决的是同一个根源。`,
  },
  {
    t: 'some View 中的 some 是什么?为什么 body 不能直接返回 View 协议?',
    lv: 2, fq: 2, tags: ['some View', '不透明类型', 'ViewBuilder'],
    key: ['some=编译期确定具体类型但不写名,保留泛型特化与 diff 性能', 'View 是协议,作为类型必须 any 或泛型;性能与身份判定都需要具体类型'],
    a: `**\`some\` 是不透明返回类型**:body 返回表达式**编译期的真实类型是固定的**(比如 \`VStack<TupleView<(Text, Image)>>\`),只是不必写出来。这带来:

1. **类型信息保留给编译器**:可以静态派发/内联/特化,没有 existential container 开销
2. **结构 diff 可行**:SwiftUI 通过类型 + 位置识别 identity,必须是**确定的类型形状**
3. 调用方语文上只承诺"是某种 View",不承诺是哪一个

**为什么不能 \`var body: View\`**:

- 协议带 Self 与关联类型约束,运行期多态必须装箱到 **any View**(5.7 起显式),这是**运行期擦除**,identity 与 diff 的类型线索丢失,系统就只能当 \`AnyView\` 处理
- \`AnyView\` 的代价是这层擦除 + 类型层级妨碍(还有多余的 retain)

**什么场景可以**:\`AnyView\` 必要时救火(如真正异构的动态内容),但要用"最小化擦除面、外层仍是具体类型"的策略;\`Group/ViewBuilder\` 的分支返回其实由 \`_ConditionalContent\` 保留了具体类型,**if/else 在 body 里是合法的类型路径**。`,
  },
  {
    t: 'SwiftUI 与 UIKit 怎么互操作?UIViewRepresentable 的生命周期?',
    lv: 2, fq: 3, tags: ['UIViewRepresentable', 'UIHostingController', '混编'],
    opt: ['SwiftUI 无法嵌入 UIKit 视图', 'UIHostingController 嵌 SwiftUI,UIViewRepresentable 嵌 UIKit,updateUIView 要幂等', 'updateUIView 只会被调用一次', 'Coordinator 用于管理视图布局'],
    ans: 1,
    key: ['UIKit→SwiftUI:UIHostingController;SwiftUI→UIKit:UIViewRepresentable 三件套', 'makeUIView 建、updateUIView 层数据,dismantleUIView 收尾'],
    a: `**两套桥**:

**UIKit 内嵌 SwiftUI**:\`UIHostingController(rootView:)\` 当作普通 VC 用,push/present/addChild。注意尺寸自适应(\`sizingOptions\`)、导航栏样式冲突、背景透明时的底色穿透。

**SwiftUI 内嵌 UIKit**:实现 \`UIViewRepresentable\`:

\`\`\`swift
struct MapView: UIViewRepresentable {
    @Binding var center: CLLocationCoordinate2D
    func makeUIView(context: Context) -> MKMapView { MKMapView() }
    func updateUIView(_ uiView: MKMapView, context: Context) {
        uiView.setCenter(center, animated: true)   // 每次状态变化调用,务必幂等
    }
    func makeCoordinator() -> Coordinator { Coordinator(self) }   // 当需要 delegate 回传
}
\`\`\`

**生命周期细节**:

- \`makeUIView\`:初次创建
- \`updateUIView\`:每次 SwiftUI 端状态变化后**可能非常频繁**,**要幂等**(判变化再设)
- \`dismantleUIView\`:视图销毁时回调,释放 delegate/KVO/Timer
- \`Coordinator\`:把 UIKit 的 delegate 回传转成 SwiftUI 的 Binding/回调

**性能提示**:在 updateUIView 里**不要无条件重建子树**,只同步差异;Representable 的尺寸由 SwiftUI 布局提议,UIKit 视图需要在 \`sizeThatFits\` 协议方法里给合理默认值。`,
  },
  {
    t: 'SwiftUI 的布局是怎么工作的?修饰符的顺序为什么重要?',
    lv: 3, fq: 2, tags: ['布局', 'frame', '修饰符顺序'],
    key: ['父提议尺寸 → 子决定要多少 → 父放置子,反复协商', '修饰符顺序改变"包了几层",frame 只影响它之前的内容'],
    a: `**三步协商**:

1. **父**给子一个**提议尺寸**(proposed size)
2. **子**报回**自己的需求尺寸**(Text 报内容尺寸,fixedSize 报内在尺寸,flexible 的报尽量大)
3. **父**在自己的几何内**放置**子

**\`frame(width:height:)\` 不改变子视图内容**,它包一层"把固定大小要求报回父"的容器;于是**修饰符顺序改变的就是包层的次序**:

\`\`\`swift
Text("Hi")
    .padding()               // 先包一圈 padding(层1)
    .background(Color.red)   // 背景画在层1区域(红到 padding 外缘)
    .frame(width: 100)       // 再包 frame(层2),要求高 100
\`\`\`

如果 background 写在 padding 前,红只到文本边缘。

**进阶**:

- \`layoutPriority(1)\` 在父空间不足时优先满足
- \`GeometryReader\` 会**吃掉全部剩余空间**再告诉你几何,副作用大,iOS 16+ 的 \`Layout\` 协议与 \`containerRelativeFrame\`(iOS 17)是更干净的武器
- \`fixedSize()\` 防被父"拉宽/压扁",文本多行截断与省略号全靠这些协商`,
  },
  {
    t: 'SwiftUI 性能优化清单?',
    lv: 3, fq: 3, tags: ['SwiftUI 性能', 'Equatable', 'List'],
    opt: ['尽量使用 AnyView 来统一类型', '拆小视图收窄依赖、把计算移出 body、ForEach 用稳定 id、避免 AnyView', 'body 里做排序解码没有性能影响', 'ForEach 用数组下标做 id 最稳妥'],
    ans: 1,
    key: ['少依赖:视图拆小+@Observable 精准;少计算:把重活搬出 body;稳 identity:ForEach id 稳定', '工具:Self._printChanges() + Instruments SwiftUI'],
    a: `**依赖收窄**:

1. **视图拆小**:每行/每块独立小 View,各自订阅各自的状态
2. **\`@Observable\` 替代 @Published**:属性级追踪,精准刷新旁支
3. \`Equatable\` 视图 + \`.equatable()\` 剪枝,子树输入没变就跳过重算

**计算挪出 body**:

4. 把排序/解码/格式化放 VM,body 里**不做任何工作**(body 会被频繁重算)
5. 图像**预解码 + 按尺寸下采样**,列表每帧绑定不同的工作都移出
6. 大量静态文本 **precompile** 聚合

**结构稳定**:

7. \`ForEach\` 用**稳定 id**(业务主键),别用数组下标
8. 避免 \`AnyView\` 装箱,\` Group\` 和 \`@ViewBuilder\` 保持具体类型

**清单尾声**:

9. 大列表 \`List\` 自带懒加载,更复杂的用 \`LazyVStack\` 但注意懒栈的高度测量
10. **诊断**:\`Self._printChanges()\`(打谁在变)、Instruments SwiftUI 模板看 body 耗时与计数

**反面教材**:把 \`ObservableObject\` VM 注入 1000 行 List 的行视图,任何 @Published 一响全页重算。`,
  },
  {
    t: 'NavigationStack 相比 NavigationView 解决了什么?怎么做编程式导航?',
    lv: 2, fq: 2, tags: ['NavigationStack', '程序式导航', '深链'],
    key: ['路径驱动:栈里是值而不是视图,深链/回跳/持久化成为可能', 'NavigationPath 值可序列化,恢复栈'],
    a: `**老 NavigationView 的痛**:\`NavigationLink(destination:)\` **创建视图就构建目标视图**(提前工作),push/pop 只能依赖 isActive/selection 深浅不一的绑定,深链与中间页回跳很痛苦。

**\`NavigationStack\`(iOS 16+)模型**:

- 栈里压的是**数据值**(路由模型),不是视图;用 \`navigationDestination(for: Destination.self)\` 注册"这种类型的值由哪个视图呈现"
- **编程式导航**:\`@State var path: [Route]\` / \`NavigationPath\`,业务层改 path 即跳

\`\`\`swift
NavigationStack(path: $path) {
    ListView()
        .navigationDestination(for: Article.self) { article in
            DetailView(article: article)
        }
}
path.append(article)          // 进详情
path.removeLast()             // 后退
path = []                     // 回根
path = [.home, .category(id: 3), .article(id: 9)]   // 深链直达
\`\`\`

**收益**:深链/通知跳转 = 构造 path;弹层与栈解耦;type-safe 路由。

**仍要留心**:长栈里 destination 的 destination 用 lazily 创建,但 SwiftUI 不会帮你管理每个目标视图的状态,StateObject 出生地原则仍然适用。`,
  },
  {
    t: 'SwiftUI 与 UIKit 的优缺点对比?项目里如何混用?',
    lv: 2, fq: 3, tags: ['SwiftUI vs UIKit', '迁移策略'],
    opt: ['SwiftUI 已能完全替代 UIKit', 'SwiftUI 开发效率与跨平台一致性强,UIKit 在极限性能与成熟生态上仍有优势', 'UIKit 无法与 SwiftUI 混用', '老项目应一次性全量重写为 SwiftUI'],
    ans: 1,
    key: ['SwiftUI 开发效率与一致性;UIKit 极致控制与成熟生态', '绞杀者模式:新页面 SwiftUI,老页按收益迁'],
    a: `**SwiftUI 优势**:

- 声明式 + 状态驱动,业务代码量下降,跨平台一致(iOS/macOS/watchOS/visionOS)
- 预览/热重载,\`#Preview\` 秒回,联调成本显著下降
- Combine / Observation / async,数据线与 UI 收敛

**SwiftUI 的代价**:

- 复杂自定义布局和高频刷新的**极限性能**仍要 \`Canvas\`/Core Animation 兜底
- 版本碎片:新 API(Liquid Glass、Observation、原生 WebView)有 iOS 起点
- 偶尔因"不理解 body 重算"写出性能灾难

**UIKit 的优势**:九成熟工程实践、精细控制、底层 API 全景可用。

**混用策略(绞杀者模式)**:

1. 基建先行:设计系统组件库、统一 Router、VM 协议
2. 桥双向打通:\`UIHostingController\` + \`UIViewRepresentable\`
3. 新页面一律 SwiftUI,老页按**收益-成本**排序迁移(高频简单页先上)
4. 双跑期统一埋点与 AB,灰度逐步放量,**禁止**新增 UIKit 页面的团队约定

**2026 视角**:UIKit 不会被"淘汰",但新特性重心(Liquid Glass、Widget、visionOS)都在 SwiftUI 一侧,懂 UIKit 并对 SwiftUI 有原理解读能力,是主流大厂的画像。`,
  },
  {
    t: 'PreferenceKey 是干什么的?和 EnvironmentKey 的区别?',
    lv: 3, fq: 1, tags: ['PreferenceKey', 'EnvironmentKey', '布局'],
    key: ['PreferenceKey:子 → 父传值(自下而上);EnvironmentKey:父 → 子注值(自上而下)', '典型:把子视图几何宣告给祖先生成边框/气泡/联动'],
    a: `**两条数据通道方向相反**:

- **\`EnvironmentKey\`**(\`@Environment\`):**祖先 → 后代**注入配置,如 \`colorScheme\`、locale、自定义 theme
- **\`PreferenceKey\`**:**后代 → 祖先**上报事实,子树里多个视图上报时按 \`reduce\` 合并

\`\`\`swift
struct TitleKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}
// 子视图上报自己的高度:
Text("标题")
    .background(GeometryReader { g in
        Color.clear.preference(key: TitleKey.self, value: g.size.height)
    })
// 祖先监听:
.onPreferenceChange(TitleKey.self) { h in self.titleHeight = h }
\`\`\`

**常见用途**:气泡跟随(子视图宣告 anchor)、自定义布局时测子视图尺寸、联动滚动导航栏(滚动 offset 上报给包装器)。

**注意**:值变更推动布局但在**同一 pass** 中子改变又是基于父,**小心成环**,大型联动场景考虑 iOS 16+ \`Layout\` 协议,或者直接用 \`@Observable\` 对象显式上报。`,
  },
  {
    t: 'GeometryReader 有什么副作用?现代替代方案?',
    lv: 3, fq: 2, tags: ['GeometryReader', 'Layout 协议', 'containerRelativeFrame'],
    key: ['GeometryReader 是 eager 视图,吃掉全部剩余空间并引发全量重算频率放大', '用 Layout 协议 / containerRelativeFrame / onGeometryChange 取代'],
    a: `**副作用**:

1. **贪婪扩张**:GeometryReader 报回的尺寸是"父给多少吃多少",把它嵌在小区域要考虑清楚,否则把父布局拉歪
2. **频繁触发**:每次容器尺寸变化任何子视图都**重建**,加上内部再读几何,一层套一层放大重算
3. **语义污染**:布局需求(阅读子尺寸/贴边/比较)嵌在视图层级里,难测试

**按场景替代**:

- **只占父容器比例**:iOS 17 的 \`.containerRelativeFrame([.horizontal, .vertical]) { length, _ in length * 0.6 }\`,一句话告别 GR
- **知道一个视图几何而不影响布局**:iOS 16+ \`.onGeometryChange(for:)\`,只观察不参与布局
- **自定义容器**(流式布局、环形排布):iOS 16+ **\`Layout\` 协议**,实现 \`sizeThatFits\` + \`placeSubviews\`,性能与语义双赢
- **子→父通知**:PreferenceKey(见上题)

**面试提示**:能随口说出 "GeometryReader 是拿布局**换信息**的工具,代价是参与布局" 这个权衡,再加一个对应的替代,就达标。`,
  },
  {
    t: 'SwiftUI 中的 .task 与 onReceive 有什么区别?',
    lv: 2, fq: 2, tags: ['.task', 'onReceive', '生命周期'],
    key: ['.task 是结构化异步入口,与视图 identity 同生共死;onReceive 是 Combine 订阅,要管 cancellable', '两者都能驱动状态,.task 更适合一次性异步工作'],
    a: `**.task**:现代入口,异步环境:

- 任务在视图出现(identity 建立)时启动,**视图消失自动取消**,\`.task(id:)\` 时 id 变化重启
- 可以 \`await\`,可以捕获 actor 隔离上下文(MainActor 可改状态)
- 典型:页面数据拉取、订阅 AsyncSequence

\`\`\`swift
.task {
    for await note in NotificationCenter.default.notifications(named: .sync) {
        await handle(note)
    }
}
\`\`\`

**onReceive**:Combine 世界的订阅点:

- 接 \`Publisher\`(timer、NotificationCenter.publisher、自定义 subject),闭包同步触发
- **不会自动取消**(视图消失后 publisher 仍可能发,要自己 \`store(in:)\` 或限制)
- 典型:与旧 Publisher 桥接

**选型规律**:一次性异步 → \`.task\`;持续感知 Combine 流 → onReceive;新项目优先把通知/定时换成 \`AsyncSequence\` + \`.task\`(更结构化)。`,
  },
]);
