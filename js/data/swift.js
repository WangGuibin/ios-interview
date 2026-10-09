/* iOS 题宝库 · data/swift.js:Swift 语言 */
'use strict';

QB.add({
  key: 'swift', name: 'Swift 语言', icon: 'cSwift', tint: '#F05138',
  desc: '值语义、可选类型、闭包、派发机制与泛型协议',
}, [
  {
    t: 'struct 和 class 的区别?什么场景优先用 struct?',
    lv: 1, fq: 3, tags: ['值语义', 'struct', 'class'],
    opt: ['struct 支持继承,class 不支持', 'struct 是值类型按值拷贝,class 是引用类型共享实例', 'struct 一定分配在栈上,永不进堆', 'class 的赋值也是深拷贝'],
    ans: 1,
    key: ['struct 值类型,赋值即拷贝;class 引用类型,共享同一实例', '默认 struct;要继承、身份、共享可变状态才 class'],
    a: `**一句话**:struct 是值类型,class 是引用类型,选型口诀是"默认 struct,确有理由才 class"。

**核心区别**:

- 存储与拷贝:struct 通常栈分配、赋值/传参按值拷贝(集合类型有写时复制优化);class 堆分配、由 ARC 管理引用计数
- 继承:只有 class 支持继承、重写、\`deinit\`、\`===\` 身份比较
- 修改语义:struct 方法改自身要标 \`mutating\`;\`let\` 常量实例的 struct 属性不可改,class 的可改

**优先 struct 的场景**:模型数据、几何值、意图明确的所有权传递、SwiftUI View(值类型让 diff 高效)。**用 class 的场景**:需要共享可变状态(如缓存、连接)、需要身份语义、与 Objective-C 互操作、需要继承体系。

> Apple 官方建议:Default to struct, use class when you need reference semantics. 值类型天然免疫数据竞争,这也是 Swift 6 严格并发下的加分项。`,
    deep: `**追问:struct 一定在栈上吗?**

不一定。被闭包捕获逃逸、作为 class 成员、装进 existential container(超 3 个 machine word 放不下 inline buffer)时都会堆分配。所以"struct 快因为都在栈上"是过度简化,要会纠偏。`,
  },
  {
    t: '什么是 Copy-on-Write(COW)?Array 是怎么实现的?',
    lv: 2, fq: 3, tags: ['COW', 'Array', '值语义'],
    opt: ['每次赋值都立即深拷贝一份存储', '赋值只拷贝引用,修改时若存储非唯一持有才真正复制', 'COW 同时保证了线程安全', 'COW 只对 String 生效'],
    ans: 1,
    key: ['拷贝只复制引用(廉价),修改时才真正复制存储', '判断依据:isKnownUniquelyReferenced'],
    a: `**一句话**:写时复制让值类型的拷贝接近 O(1),又保住值语义。

Array / Dictionary / String / Set 内部持有一个**堆上的存储引用**。赋值时只拷贝这个引用,新旧实例共享同一块存储;当任一实例发生**修改**时,先检查存储是否被唯一持有(\`isKnownUniquelyReferenced(&storage)\`):

- 唯一:直接在原存储上改,零拷贝
- 不唯一:先深拷贝存储再修改,之后各自独立

**为自定义类型实现 COW**:把可变状态包进一个 \`final class Box\`,struct 持有 Box 引用,公开方法标 \`mutating\`,内部改 Box 前先 \`isKnownUniquelyReferenced\` 判断,不唯一就 \`Box(box.value)\` 复制一份。

**面试陷阱**:COW 的检查发生在每次"可能写入"时,多线程下并发写同一个 Array 仍然是数据竞争,COW 不等于线程安全。`,
  },
  {
    t: 'strong、weak、unowned 的区别?怎么选?',
    lv: 1, fq: 3, tags: ['weak', 'unowned', 'ARC'],
    key: ['weak 可选型,释放自动置 nil;unowned 非可选,访问已释放对象即崩溃', '拿不准就 weak'],
    a: `| 修饰 | 引用计数 | 类型 | 对象释放后 |
|------|-----------|------|-----------|
| strong(默认) | +1 | 非可选 | 保活,不释放 |
| weak | 不计数 | **可选型** | 自动置 nil |
| unowned | 不计数 | **非可选** | 变野引用,访问即崩 |

**怎么选**:

- \`weak\`:对方**可能先死**(delegate、闭包里的 self、数据源),用前解包,最安全
- \`unowned\`:确定**对方死时自己必死**(如子对象持有父对象、闭包与其宿主同生共死),省去了解包,但用错就是崩溃
- \`unowned(unsafe)\`:连运行时检查都没有,纯 C 式悬垂指针,基本别用

> 口诀:能 weak 不 unowned;unowned 只用于"同生共死"的强不变式。`,
    opt: ['weak 是可选类型,对象释放后自动置 nil', 'unowned 访问已释放对象会返回 nil', 'weak 和 unowned 都不增加引用计数', 'unowned 适合双方生命周期一致的场景'],
    ans: 1,
  },
  {
    t: '闭包什么时候必须写 [weak self]?什么时候是多余的?',
    lv: 2, fq: 3, tags: ['闭包', '循环引用', 'weak self'],
    opt: ['所有闭包都必须写,否则一定泄漏', '只有形成引用环时才必须:self 持有闭包且闭包持有 self', 'DispatchQueue.main.async 里必须写', 'UIView.animate 里必须写'],
    ans: 1,
    key: ['只有形成环(self 持闭包,闭包持 self)才必须', 'GCD 一次性任务、UIView.animate 不需要'],
    a: `**判定标准:是否存在引用环。** self 持有闭包(存成属性/注册为观察者),闭包又强引用 self,才需要 \`[weak self]\`。

\`\`\`swift
// 必须:self 持有 onUpdate,闭包逃逸存储并持有 self
service.onUpdate = { [weak self] _ in self?.reload() }

// 不需要:GCD 任务执行完即释放,self 不持有这个闭包
DispatchQueue.main.async { self.reload() }

// 不需要:UIView.animate 的非逃逸/系统托管动画闭包
UIView.animate(withDuration: 0.25) { self.view.alpha = 0 }
\`\`\`

**\`guard let self\`(weak-strong dance)的作用**:避免闭包执行到一半 self 被释放导致的中间态。注意 \`guard let self\` 之后闭包内是强 self,**不会**造成永久环(闭包执行完即释放),但会延长本次执行期间 self 的生命。

**易错点**:闭包捕获的是**变量**,值类型捕获的是当时的值(class 捕获相当于强引用对象本身);捕获列表 \`[x = self.foo]\` 可以固化当时的计算结果。`,
  },
  {
    t: 'lazy 属性是线程安全的吗?',
    lv: 2, fq: 2, tags: ['lazy', '线程安全'],
    key: ['不安全:首次访问竞态可能初始化多次', '要线程安全用 let / actor / 锁'],
    a: `**不安全。** \`lazy\` 本质是"首次访问时才执行初始化表达式"的普通存储属性,编译器没有为它加任何同步。

多线程下两个线程同时**首次**访问一个 lazy 属性,可能:

- 初始化代码执行多次,产生两个实例
- 一方读到尚未赋值完成的中间态

**替代方案**:

- 确定不变的用 \`let\`:Swift 保证 let 的全局/静态常量初始化只执行一次(底层走类似 dispatch_once 的机制)
- 需要懒加载且线程安全:包进 actor、加锁,或用 \`OSAllocatedUnfairLock\` / Synchronization 的 \`Mutex\`(iOS 18+)

**附加考点**:\`lazy\` 不能用于 \`let\`(很直白:常量要求初始化完成时就有值,而 lazy 就是延迟赋值);lazy 属性是 \`mutating\` 写入,访问 lazy 的 struct 方法也得是 mutating。`,
  },
  {
    t: '多个 defer 的执行顺序?在循环里用 defer 有什么坑?',
    lv: 1, fq: 2, tags: ['defer', '控制流'],
    key: ['LIFO 后进先出', '循环中的 defer 攒到函数返回才执行'],
    a: `**后进先出(LIFO)**,像栈:

\`\`\`swift
func f() {
    defer { print("1") }
    defer { print("2") }
    defer { print("3") }
}
// 输出 3 2 1
\`\`\`

defer 适合做**成对资源管理**:加锁/解锁、打开/关闭文件、开始/结束上报,写在资源获取之后立刻配对,可读性远好于在各出口散落调用。

**坑点**:

- defer 归属的是**当前作用域**,不是当前循环体。\`for\` 循环里写的 defer 不会每圈结束执行,而是攒到整个函数返回才一次性执行,如果在循环里持有大资源(文件句柄、内存)会堆积,要在循环内手动收尾或包一层函数调用
- defer 块内引用的变量**在执行时求值**,不是注册时的快照(class 引用)`,
    opt: ['1 2 3', '3 2 1', '2 1 3', '编译错误'],
    ans: 1,
  },
  {
    t: 'Optional 的本质是什么?解包有哪几种方式?',
    lv: 1, fq: 3, tags: ['Optional', '解包'],
    opt: ['Optional 是编译器特殊处理的关键字,没有底层类型', 'Optional 是含 none / some(Wrapped) 两个 case 的枚举', 'Optional 本质是指针可空标记', 'Optional 只能用于引用类型'],
    ans: 1,
    key: ['本质是两 case 的枚举:none / some(Wrapped)', 'if let 局部、guard let 主流程、?? 给默认值'],
    a: `Optional 不是语法特例,标准库里就是一个**泛型枚举**:

\`\`\`swift
enum Optional<Wrapped> {
    case none
    case some(Wrapped)
}
\`\`\`

\`?\`、\`!\`、\`if let\`、\`guard let\`、\`??\`、可选链都只是这个枚举的语法糖。

**解包方式与适用场景**:

- \`if let x = x\`:局部使用,两道以内嵌套时
- \`guard let x = x else { return }\`:主流程必须非空,提前返回消灭嵌套金字塔(推荐)
- \`x ?? default\`:提供默认值,一行收敛
- 可选链 \`a?.b?.c\`:纯读取穿透,中间任何一环 nil 则整体 nil
- \`x!\` 强制解包:运行时断言,只在不变式 100% 成立时用(IBOutlet 那种)
- \`map\` / \`flatMap\`:对值做变换,\`flatMap\` 可再压平一层 Optional

> Swift 5.7 起支持 \`if let x { }\` 简写,省略 \`= x\`。`,
  },
  {
    t: 'if let 和 guard let 的区别?',
    lv: 1, fq: 2, tags: ['guard', 'Optional'],
    key: ['guard 解包后可在后续作用域直接用,if let 只在块内', 'guard 必须搭配离开语句'],
    a: `**作用域**是本质区别:\`if let\` 解出来的值只在花括号内有效;\`guard let\` 解出来的值在**后续整个作用域**都可用。

\`\`\`swift
// guard:主路径保持平铺,失败路径提前退出
guard let user = user else { return }
print(user.name)   // 直接用

// if let:主路径缩进一层
if let user = user {
    print(user.name)
}
\`\`\`

**guard 的 else 必须离开当前作用域**(return / throw / break / continue,或调用 \`Never\` 返回的函数),编译器强制,这正是"黄金路径永远最左"的工程价值。

**口诀**:校验前置条件用 guard;一次性的局部消费用 if let。`,
  },
  {
    t: 'any 和 some 的区别?(Swift 5.7 起)',
    lv: 3, fq: 2, tags: ['泛型', '存在类型', '不透明类型'],
    key: ['some:编译期确定唯一类型,零开销;any:运行期任意类型,装箱派发', '带 associatedtype 的协议只能靠 any/泛型使用'],
    a: `**\`some P\`(不透明类型)**:函数内部对应的**具体类型是编译期唯一确定**的,只是对调用方隐藏名字。本质是泛型的反向写法,保留完整类型信息,静态派发,零运行时开销。\`some View\` 的 body 就是这个语义。

**\`any P\`(存在类型)**:一个运行期**容器(existential container)**,可以装任何遵守 P 的类型。数组里能混装不同实现,但付出代价:装箱、动态派发(witness table)、小对象内联大对象堆分配。

\`\`\`swift
func makeBadge() -> some View { Text("1") }   // 返回类型固定为 Text,只是不透明
let services: [any OrderServicing] = [HTTP(), Mock()]  // 数组混装不同实现
\`\`\`

**为什么 5.7 要显式写 \`any\`**:带 \`associatedtype\` 或 Self 要求的协议(如 \`Equatable\`、\`Publisher\`)过去不能直接当类型用,会导致"protocol can only be used as a generic constraint"报错;写泛型或 \`any\` 才合法,显式语法把"有性能代价的类型擦除"变成一项显式决策。

**选型**:能用泛型/some 就不用 any(更快);需要异构集合或运行时替换实现时用 any。`,
  },
  {
    t: '@escaping 是什么?为什么闭包默认不允许逃逸?',
    lv: 2, fq: 3, tags: ['@escaping', '闭包'],
    opt: ['@escaping 表示闭包会在函数返回前执行完', '@escaping 表示闭包可能在函数返回后才执行,需显式标注', '非逃逸闭包也需要显式写 self.', '@escaping 闭包不会产生循环引用'],
    ans: 1,
    key: ['逃逸=函数返回后闭包仍可能执行', '默认非逃逸=参数不能存储,编译器可省堆分配且免写 self.'],
    a: `**@escaping** 标注的闭包允许在**函数返回之后**仍然存活:被存进属性、放进异步回调、捕获进另一个逃逸闭包。这三种情况编译器强制你标注,标注等于对调用者声明"这个闭包可能比函数活得久,小心循环引用"。

**为什么默认非逃逸**:

- 性能:非逃逸闭包的生命周期被函数调用栈圈定,编译器可以不在堆上为其捕获列表分配存储
- 安全:非逃逸闭包里引用 self **不需要写 \`self.\`**,因为不形成环,不需要你警觉所有权

**配套**:\`@autoclosure\` 把表达式自动包装成闭包来延迟求值,典型是 \`assert\`、\`??\` 的默认表达式和短路运算符:\`func log(_ s: @autoclosure () -> String)\`,调用处写普通表达式,只有真正需要时才求值。`,
  },
  {
    t: 'inout 参数的原理?和引用传递有什么区别?',
    lv: 2, fq: 2, tags: ['inout', '参数传递'],
    key: ['copy-in copy-out 语义,非真正传引用', '同一变量不能同时作两个 inout 参数(独占性)'],
    a: `**\`inout\` 是"输入输出参数"**:函数内对参数的修改会写回调用处。

\`\`\`swift
func bump(_ x: inout Int) { x += 1 }
var n = 1
bump(&n)   // n == 2
\`\`\`

**官方语义是 copy-in copy-out**:进函数时拷贝一份,函数正常返回时把结果写回原存储。编译器对直接访问存储属性有优化,但语义模型是"拷贝进出",而不是 C++ 那种引用别名,比如中途异步修改原变量不会同步进来。

**约束**:

- 只能传**可变**实参:不能传 \`let\`、字面量、计算属性的 get-only 版本
- **独占性访问**:同一变量不能同时作为两个 inout 实参(\`swap(&a, &a)\` 编译错),也不能在读操作未结束时被写
- 常用于就地修改的小工具:\`swap\`、解析器推进游标等`,
  },
  {
    t: 'mutating 关键字的作用?协议里声明 mutating,class 实现要写吗?',
    lv: 1, fq: 2, tags: ['mutating', '值语义'],
    key: ['值类型方法默认不能改自身,mutating 解锁', 'class 实现可以不写'],
    a: `struct / enum 的方法**默认不允许修改自身属性**,因为方法是 \`self\` 的隐式 \`let\` 参数。标了 \`mutating\` 之后:

- 可以修改存储属性,甚至给 \`self\` 整体赋新值(\`self = NewValue()\`)
- 调用它的实例本身必须是 \`var\`,常量实例调 mutating 编译错

**协议部分**:协议可以要求 \`mutating func\`,值类型实现者必须写 \`mutating\`,但 **class 实现者不用写**(class 天然能改),这就是协议对两种类型系统的兼容设计。

**延伸**:默认不写 mutating 是 Swift 值语义纪律的一部分,读代码时 \`mutating\` 就是"此函数会改变状态"的高亮标签。`,
  },
  {
    t: 'Swift 的方法派发有哪几种方式?各受什么关键字影响?',
    lv: 3, fq: 3, tags: ['方法派发', 'dynamic', 'final'],
    key: ['静态 > 表派发 > 消息派发,依次变慢', 'final/static 静态;普通 class 方法表派发;@objc dynamic 消息派发'],
    a: `三种派发,速度递减:

| 派发 | 触发条件 | 特点 |
|------|----------|------|
| **静态派发** | struct/enum 方法、\`final\`、\`private\`、\`static\`、extension 中未暴露的方法 | 编译期定址,可内联,最快 |
| **表派发(V-Table)** | class 的可重写方法、协议的 witness table | 查虚表调用,支持多态,一次间接跳转 |
| **消息派发** | \`@objc dynamic\`、继承 NSObject 的 runtime 路径 | 走 \`objc_msgSend\`,支持 swizzling / KVO,最慢最灵活 |

**关键判断**:

- \`final\`:禁止继承与重写 → 静态派发,还能触发内联
- \`@objc\`:仅暴露给 OC 调用方,**不改变** Swift 侧的派发方式;要消息派发必须联合 \`dynamic\`
- \`dynamic\`:强制 runtime 消息机制,KVO / 方法交换的前提
- extension 里的方法默认静态派发,所以**不能被子类重写**,想多态要放进类主体或加 \`@objc\`

> 性能敏感热路径(如大列表 cell 配置)尽量 struct 协议 + 静态派发;需要 AOP 能力才付出消息派发的代价。`,
    opt: ['final 让方法走消息派发', 'extension 中的方法默认可以被子类重写', '@objc dynamic 的方法走 objc_msgSend 消息派发', 'private 方法必须走表派发'],
    ans: 2,
  },
  {
    t: 'compactMap 和 flatMap 有什么区别?',
    lv: 1, fq: 3, tags: ['高阶函数', 'flatMap', 'compactMap'],
    key: ['compactMap:变换+滤掉 nil;flatMap:变换+拍平一层嵌套', 'Optional 上的 flatMap 变换结果可再压平'],
    a: `**\`compactMap\`**:对每个元素做变换,**结果是 nil 的丢弃**:

\`\`\`swift
["1", "a", "3"].compactMap(Int.init)   // [1, 3]
\`\`\`

**\`flatMap\`** 按上下文有两种含义:

- 序列上是"变换 + 拍平一层":\`[[1,2],[3]].flatMap { $0 }\` → \`[1, 2, 3]\`,等价 \`.map { ... }.joined()\`
- Optional 上(以及元素是 Optional 的变换)是"变换后若产生新 Optional 再压平一层",避免 \`Int?? \` 双重嵌套

**性能提示**:链式 \`.map\`.filter\` 会创建多个中间数组,大数组或热路径考虑 \`lazy\` 序列(\`array.lazy.map...\`)让每步融合执行。

**对应记忆**:compactMap 的名字就写着 "compact",紧凑掉 nil;flatMap 的 "flat",拍平嵌套。`,
    opt: ['[1, 2, nil]', '[1, 3]', '[1, nil, 3]', 'crash'],
    ans: 1,
  },
  {
    t: 'String 的索引为什么不是 Int?string.count 为什么慢?',
    lv: 2, fq: 2, tags: ['String', 'Unicode', 'String.Index'],
    key: ['Character=扩展字素簇,宽度不定,只能线性走', 'count 是 O(n);只检查空用 isEmpty'],
    a: `Swift 的 \`Character\` 是**扩展字素簇(extended grapheme cluster)**,一个词可能由多个 Unicode 标量拼成:旗帜 🇨🇳 是两个 regional indicator,家庭 👨‍👩‍👧 是三个人形加 ZWJ,é 可以是 \`e + ́\` 组合。所以"第 n 个字"在 UTF-8/UTF-16 里**字节宽度不定**,无法像数组一样下标寻址,于是索引用不透明的 \`String.Index\`,只能 \`startIndex\` / \`index(after:)\` 线性移动。

**推论**:

- \`str.count\` 要**逐字符走一遍**,O(n) 复杂度,且首次访问后要缓存;判空写 \`isEmpty\`
- 切片得到 \`Substring\`,与原串共享存储,长串小切片会把整串拖住,用完包一层 \`String()\`
- 与 \`NSString\` 桥接时 \`NSRange\` 按 UTF-16 计,和 Swift 的 Character 口径不同,处理 emoji/组合序列时容易截错位

**面试话术**:这不是性能倒退,而是 Swift 把"用户感知的字符"和"字节"彻底解耦,避免其他语言里常见的 emoji 截断乱码。`,
  },
  {
    t: '@propertyWrapper 的原理?wrappedValue 和 projectedValue 是什么?',
    lv: 2, fq: 2, tags: ['PropertyWrapper', '属性包装器'],
    key: ['把存取逻辑收敛到包装器类型,编译器生成 get/set 代理', 'projectedValue 用 $ 访问,如 @Published 的 publisher'],
    a: `**原理**:把一个实现了 \`wrappedValue\` 的 struct/class 声明为 \`@propertyWrapper\`,用它标注属性时,编译器把原属性改写为:

\`\`\`swift
@Trimmed var name: String
// 等价于
private var _name = Trimmed()
var name: String {
  get { _name.wrappedValue }
  set { _name.wrappedValue = newValue }
}
private var $name: Trimmed  // 当定义了 projectedValue 时
\`\`\`

- **wrappedValue**:外部读写属性时真正走到的值(必须经过它)
- **projectedValue**:用 \`$name\` 访问到的投影,比如 \`@Published\` 的 \`$x\` 是 Publisher,\`@State\` 的 \`$x\` 是 Binding

**经典手写题**:实现 \`@UserDefault<T>\`(读写 UserDefaults)、\`@Clamped\`(夹取范围)、\`@Atomic\`(内部加锁)。提示:包装器内不能用 weak 捕获宿主 struct 的方案,所以 \`@UserDefault\` 在每个实例里各自独立,不存在"跨 ViewModel 共享"的问题。

**注意**:带 \`init(wrappedValue:)\` 的包装器才支持 \`@Wrapper var x = 初值\` 语法;否则要在属性上写全 \`@Wrapper(defaultValue: 0) var x\`。`,
  },
  {
    t: 'Swift 的访问控制级别?open 和 public 的区别?',
    lv: 1, fq: 2, tags: ['访问控制', 'open', 'public'],
    key: ['open 跨模块可继承重写,public 仅本模块内可继承重写', 'private 紧邻作用域,fileprivate 同文件,internal 同模块,package 同包'],
    a: `由严到宽:

1. **private**:紧邻作用域(含同类型 extension 同文件可见)
2. **fileprivate**:当前文件内
3. **internal**(默认):当前模块(target)内
4. **package**(Swift 5.9):同一 Swift Package 内跨 target,库作者做"包内共享的 API"不再被迫 public
5. **public**:跨模块可见可用,但**不能被继承/重写**
6. **open**:跨模块可见,**且允许继承和重写**

**open vs public 是高频陷阱**:库作者想让外部 App 继承你的类必须 open;不记得加 open 是很多 SDK"在外部没法继承"的报错源。协议同理,公开协议若希望外部类型实现,方法和 associatedtype 都得 public 起步。

**配套**:\`private(set) public var\` 很常见,对外只读、对内可写,封装默认值。`,
  },
  {
    t: '枚举的关联值和原始值有什么区别?indirect enum 是什么?',
    lv: 1, fq: 2, tags: ['enum', '关联值', 'indirect'],
    key: ['raw value:每 case 一份字面量且同类;associated value:每 case 携带任意载荷', '递归枚举要 indirect,让引用打破尺寸无限递归'],
    a: `**原始值(Raw Value)**:枚举整体指定一个类型(String/Int/...),每个 case 预填一个字面量,可调 \`.rawValue\`,并能 \`init?(rawValue:)\` 反解(可选,可能失败)。

**关联值(Associated Values)**:每个 case 可以像元组一样挂载任意类型载荷:

\`\`\`swift
enum LoadState {
  case idle
  case loading(progress: Double)
  case success(Data)
  case failure(Error)     // Result 就是 enum + associated values 的教科书应用
}
\`\`\`

原始值侧重"序列化互操作",关联值侧重"状态机建模",互斥,不能同时存在。

**\`indirect\`**:当枚举的关联值里包含**枚举自身**(链式结构、树、表达式语法树),存储尺寸无限递归,编译器无法确定大小;标 \`indirect\` 让该 case(或整个 enum)改为引用存储,切断尺寸递归。

\`\`\`swift
indirect enum Expr { case num(Int); case add(Expr, Expr) }
\`\`\``,
  },
  {
    t: 'Swift 中的 deinit 何时调用?struct 为什么没有 deinit?',
    lv: 1, fq: 2, tags: ['deinit', 'ARC', '生命周期'],
    key: ['引用计数归零时同步调用,在所在线程', 'struct 无引用,生命周期随作用域,无需回调'],
    a: `**\`deinit\` 是 class 的析构入口**:当对象最后一个强引用消失、引用计数瞬到 0 时**立即同步**调用,在**释放该引用的线程**上执行(若在后台释放,deinit 就跑在后台)。

**典型的用法**:移除 NotificationCenter 观察者、关闭文件句柄、释放 C 层资源、做"页面真正销毁了"的泄漏探测日志。

**为什么 struct 没有 deinit**:struct 是值类型,没有"共享实例"概念,生命周期由作用域机械决定,不存在"不知何时会死"的点,自然不需要回调;它内部的 class 成员随 struct 销毁而减引用,ARC 自己负责。

**典型坑**:

- 想在 deinit 里做异步收尾(\`Task { }\` 捕获不到 self,因为它正在销毁),要捕获前置快照
- 依赖 deinit 顺序不可靠,多个对象相互观察时,健康做法是用通知/代理显式断开,而不是赌析构时序`,
  },
]);
