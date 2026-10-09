/* iOS 题宝库 · data/objc.js:Objective-C 语言特性 */
'use strict';

QB.add({
  key: 'objc', name: 'Objective-C', icon: 'cObjc', tint: '#5B7C99',
  desc: '@property、Category、Block 与语言机制经典题',
}, [
  {
    t: '@property 的本质是什么?常用属性关键字怎么记?',
    lv: 1, fq: 3, tags: ['@property', 'atomic', 'nonatomic'],
    opt: ['property 只是成员变量的别名', 'property = ivar + getter + setter,由编译器自动合成', 'atomic 能保证业务层面的线程安全', 'nonatomic 会自动加锁'],
    ans: 1,
    key: ['property = ivar + getter/setter 方法 + 访问语义,编译器三件代写', 'atomic 只保单个存取原子性,不保业务线程安全,所以默认都写 nonatomic'],
    a: `**\`@property\` 是编译器的三合一语法糖**:声明一点,生成:

1. 一个带下划线前缀的成员变量 \`_name\`
2. \`-(type)name\` getter 方法
3. \`-(void)setName:\` setter 方法

**关键字分组记忆**:

- **原子性**:\`atomic\`(默认,getter/setter 加自旋锁保证单次读写完整) / \`nonatomic\`(不加锁,快;**几乎所有代码都写 nonatomic**,因为 atomic 只能保证"读到的值不撕裂",业务级线程安全它管不了、徒增开销)
- **读写权限**:\`readwrite\` / \`readonly\`
- **内存语义**:\`strong\` / \`weak\` / \`copy\` / \`assign\`(原语) / \`unsafe_unretained\`(对象版 assign)
- **方法名定制**:\`getter=isReady\` / \`setter=setReady:\`

**追问点**:\`self.name = x\` 走 setter 会触发 KVO、惰性校验;\`_name = x\` 直接写 ivar,绕过 KVO 与自定义 setter。dealloc 里推荐 \`_ivar = nil\` 或干脆交给 ARC,**不在 dealloc 调 setter**(可能触发子类重写导致半构造状态被访问)。`,
  },
  {
    t: 'Category(分类)和 Extension(扩展)的区别?Category 能加属性吗?',
    lv: 1, fq: 3, tags: ['Category', 'Extension', '关联对象'],
    opt: ['Category 可以直接添加实例变量', 'Extension 编译期合并可加 ivar,Category 运行期附加只能靠关联对象模拟属性', 'Category 的同名方法不会覆盖主类方法', 'Extension 可以为系统类添加成员变量'],
    ans: 1,
    key: ['Extension 编译期合并可加 ivar;Category 运行期附加,不能直接加 ivar', 'Category 要"属性"用关联对象合成存取'],
    a: `| | Extension(匿名的主类延展) | Category |
|---|---|---|
| 时机 | **编译期**把成员合进类定义 | **运行期**附加到类 |
| 内容 | 可加**实例变量**、属性、方法 | 只能加方法/属性声明,**不能直接加 ivar** |
| 可见性 | 必须能拿到实现(.m 中或与主类同处) | 任意位置、任意已有的类(包括系统类) |
| 属性 | 与主类属性等同 | 只能声明存取方法,**要自己用关联对象提供存储** |

**Category 给已有类"加属性"的标准做法**:声明 \`@property\` + 手写 getter/setter,内部用 \`objc_setAssociatedObject / objc_getAssociatedObject\` 存值(void 返回值的 set 关联策略按语义选 retain/copy/assign)。

**顺序考点**:**同名方法冲突**时 Category 的方法会**覆盖**主类实现(实际是方法列表里排前面先命中;先不讨论框架),多个 Category 重名时**编译顺序最后**的优先(不可靠,别拿覆盖当特性用,想交换实现用 Method Swizzling)。`,
    deep: `**追问:+load 和 +initialize 呢?**

- \`+load\`:类被**加载进 runtime 时**调用,main() 之前;**Category 的 +load 也会调**;会拖慢启动,启动优化要清
- \`+initialize\`:类**首次收到消息时**惰性调用,线程安全由 runtime 保证;适合做一次性懒准备
- 两个都是"先父类后子类"自动调用,别在里面做重活`,
  },
  {
    t: 'Block 的本质是什么?三种类型有什么区别?',
    lv: 2, fq: 3, tags: ['Block', '__NSStackBlock__', '__NSMallocBlock__'],
    opt: ['Block 就是一个普通的函数指针', 'Block 是含 isa、invoke 函数指针与捕获变量的结构体,分全局/栈/堆三类', 'Block 捕获的变量都可以直接修改', 'ARC 下 Block 永远在栈上'],
    ans: 1,
    key: ['Block = 结构体 + 函数指针 + 捕获上下文', 'Global/Stack/Malloc 三种,ARC 下多数自动 copy 到堆'],
    a: `**本质**:Block 是**带捕获上下文的可调用对象**,编译后是一个包含 \`isa\`、\`invoke\` 函数指针、\`descriptor\`、捕获变量副本的结构体;调用就是 \`block->invoke(block, args...)\`。

**三种类型**:

1. **\`__NSGlobalBlock__\`**:不捕获外部变量,存**全局区**,单例化的,最安全
2. **\`__NSStackBlock__\`**:捕获了变量且还没 copy,存**栈上**,作用域结束即销毁(怀旧 MRC 时代的坑)
3. **\`__NSMallocBlock__\`**:从栈 **copy 到堆**的版本,按对象方式管理引用计数,可以长期持有

**ARC 的现代结论**:赋值给 strong 属性、作为返回值返回、放进 NSArray/字典时编译器会自动 copy,**显式声明 copy 属性仍是好习惯**以表达所有权;判 block 能不能活过当前作用域,只看它最终是不是 MallocBlock。

**与 Swift 闭包的关系**:Swift 闭包底层实现不同但概念同构,捕获列表 \`[weak self]\` 对应 __block 语义层的捕捉策略。`,
  },
  {
    t: '__block 修饰符的原理?用它修改外部变量为什么有效?',
    lv: 3, fq: 2, tags: ['__block', 'Block 捕获'],
    key: ['把标量变量包装成带 forwarding 指针的间接结构体', 'ARC 下 __block 对象会被 block retain,可能成环'],
    a: `**默认捕获规则**:Block 捕获外部的 **auto 局部变量**时,按**值**快照(copy)到自身结构体里,之后外部怎么改都和 block 无关,block 内也改不了快照本体(const)。

**\`__block\` 的作用**:把它修饰的变量包装成一个**\`__Block_byref\`** 间接结构体:

\`\`\`c
struct __Block_byref_x {
    void *isa;
    struct __Block_byref_x *forwarding;  // 指向真正的存储
    int flags;
    int size;
    int x;  // 真正变量的值
};
\`\`\`

block 与外界访问都经过 \`forwarding\` 指针,**栈 copy 到堆时 forwarding 会重定向到堆版本**,于是双方都能读写同一份真值。

**内存注意点**:

- \`__block\` 修饰**对象类型**时,**MRC 下不 retain,ARC 下会 retain**,极易和 self 形成环(block 持 byref,byref 持 self,self 持 block)
- 解法与循环引用一致:捕获 \`__weak typeof(self) weakSelf\`,更轻量;追求灵活可变时捕获 \`__block typeof(self) blockSelf\`,但 block 末尾手动 \`blockSelf = nil\` 破环

**面试口诀**:普通捕获是快照,\`__block\` 是"加一个共享格子"。`,
  },
  {
    t: 'performSelector: 系列在 ARC 下有什么坑?',
    lv: 2, fq: 2, tags: ['performSelector', 'ARC', '动态调用'],
    key: ['选择器运行时才知,ARC 推断不了返回值所有权,会有泄漏警告', '替代:@selector 常量、NSInvocation、块化 API、@dynamicCallable'],
    a: `**坑点 1:返回值所有权不知**。\`performSelector:\` 的返回值在编译期ARC 无法知道是 \`retained\` 还是 \`unretained\`,对返回对象的方法(new/copy/mutableCopy 命名族)会报 "performSelector may cause a leak because its selector is unknown"。

**坑点 2:原型受限**:只能带 0:2 个对象参数,不支持基本类型/结构体/可变参数;选择器写错(参数个数、冒号个数)运行时才崩。

**坑点 3:没有编译期检查**:方法改名、删了,调用处不会报错,测试覆盖不到就上线炸。

**现代替代**:

- 类型安全的派发:\`SEL\` 常量 + \`respondsToSelector:\` 先探测
- 需要动态时用 \`NSInvocation\` 显式处理签名与返回值
- 自家代码尽量改造为**协议 + 闭包表**或 Swift 的 \`@dynamicCallable\` / KeyPath 动态派发,把"字符串选择器"逐步淘汰

**衔接点**:performSelector 是 runtime 消息发送的薄封装,透彻回答时要能接上 \`objc_msgSend\` 的流程(见 Runtime 分类)。`,
  },
  {
    t: 'isKindOfClass 和 isMemberOfClass 的区别?经典题:[[NSObject class] isKindOfClass:[NSObject class]] 结果是?',
    lv: 2, fq: 3, tags: ['isKindOfClass', '元类', '经典题'],
    key: ['isKindOf 沿继承链判断"是不是这个族",isMemberOf 只认精确类', '类对象作为接收者时,沿"类对象→元类→根元类→NSObject"走'],
    a: `**语义**:

- \`isKindOfClass:\`:接收者是不是该类**或其子类**的实例(沿 superclass 链向上找)
- \`isMemberOfClass:\`:接收者的类**严格等于**参数类

**经典题拆解**:\`[[NSObject class] isKindOfClass:[NSObject class]]\` → **YES**

接收者是"NSObject 类对象",类对象是**元类的实例**。判断时沿接收者的"类继承链"走:**NSObject 类对象 → 其类 = 根元类 → 根元类的 superclass = NSObject**。链条里出现了 NSObject,所以 isKindOf 成立。

同族变体记死:
| 表达式 | 结果 |
|---|---|
| \`[[NSObject class] isKindOfClass:[NSObject class]]\` | **YES** |
| \`[[NSObject class] isMemberOfClass:[NSObject class]]\` | NO(是根元类的实例,不是 NSObject 的) |
| \`[[NSObject new] isKindOfClass:[NSObject class]]\` | YES |
| \`[[NSObject new] isMemberOfClass:[NSObject class]]\` | YES(实例的类精确等于 NSObject) |

**一句话**:对实例对象是日常语义;对类对象,要想到"类对象也是对象,它的类是元类"。`,
    opt: ['NO,类对象不能判断类型', 'YES,因为在类继承链上存在 NSObject(经根元类的 superclass)', 'YES,因为所有对象是 NSObject 实例', '编译期错误'],
    ans: 1,
  },
  {
    t: 'SEL、IMP、Method 三者是什么关系?',
    lv: 2, fq: 2, tags: ['SEL', 'IMP', 'Method'],
    key: ['SEL=方法名编号;IMP=实现函数指针;Method=SEL 到 IMP 的结构体加类型编码', 'msgSend 就是用 SEL 查出 IMP 再跳'],
    a: `- **SEL(selector)**:方法的**名字编号**(选择器),编译期注册到一张全局字符串表,同名不同类共享一个 SEL;本质是 const char* 的不透明类型
- **IMP**:方法实现的**函数指针**,原型 \`id (*)(id, SEL, ...)\`,头两个参数固定是 self 与 _cmd
- **Method**:runtime 数据结构,把 **SEL ↔ IMP** 绑定,附带 \`method_types\` 类型编码("v@:i" 等)

\`objc_msgSend(receiver, selector, ...)\` 做的事就是在 receiver 的类方法列表/缓存里按 SEL 找 Method,拿到 IMP 后调用,找不到进入动态解析/转发链。

**实操联动**:\`method_setImplementation\` / \`method_exchangeImplementations\` 是 swizzling 的零件;\`class_addMethod\` 动态提供给类一条 SEL→IMP 的映射是消息转发补救入口。类型编码可以 \`@encode\` 得到,问 KVC/Invocation 时会涉及。`,
  },
  {
    t: 'super 关键字调用是怎么实现的?[super class] 返回什么?',
    lv: 3, fq: 2, tags: ['super', 'objc_msgSendSuper'],
    key: ['super 不是"父类对象",仍发给 self,只是查找从父类开始', '[super class] 返回 self 的类(当前类)'],
    a: `**编译实现**:\`[super method]\` 编译成 \`objc_msgSendSuper(self, @selector(method))\`,传入的是 **objc_super 结构体 { receiver: self, superclass: 当前类 }**,消息**接收者仍然是 self**,runtime 只是**从指定 superclass 开始**查方法列表。

**经典坑**:\`[super class]\` → 返回 **self 自身的类**(不是父类)。因为 class 是普通消息,沿"从指定 superclass 开始查"找到的还是继承来的 class 实现,\`object_getClass(self)\` 当然返回 self 的类。想区分实例/类对象要看上下文,不能靠 super。

**派生考点**:

- \`isKindOfClass\` 由谁实现不重要,重要的是接收者是谁(self)
- Swift 没有 super 消息机制,Swift 类走 vtable,除非 \`@objc dynamic\` 回落到 runtime
- 用 super 调用**本类里 override 又被 swizzle 的方法**时,实现是"从指定类继续查",这是 swizzling 不爆递归的原理`,
  },
  {
    t: '+load 和 +initialize 的区别?启动优化为什么要扫 +load?',
    lv: 2, fq: 3, tags: ['+load', '+initialize', '启动优化'],
    opt: ['两者都在 main 之后惰性调用', '+load 在镜像加载时(main 之前)调用,+initialize 在类首次收消息时惰性调用', '+load 会被子类继承调用多次', 'Category 的 +load 会覆盖主类的 +load'],
    ans: 1,
    key: ['+load:镜像加载即调,main 之前,Category 也算;+initialize:首条消息惰性调', '+load 多 = 启动慢;治理成懒加载/initialize'],
    a: `| | \`+load\` | \`+initialize\` |
|---|---|---|
| 触发 | 类(含 Category)**被 runtime 加载时**,main() 之前 | 类**首次收到消息时**,惰性 |
| 次数 | 每镜像一次 | 每类顶多一次,先父后子 |
| 线程 | 加载锁内,串行 | runtime 保证安全 |
| 对启动影响 | **直接拖慢 pre-main** | 按用到才付,友好 |

**启动优化的治理动作**:把 \`+load\` 里的注册表/路由表/第三方 SDK 配置**挪到 \`+initialize\` 或启动任务的懒执行**;Category 大量 +load 是隐藏的启动杀手(每个都跑)。

**Swift 的对应**:Swift 没有 +load;静态初始化走全局 \`static let\`(底层类似 dispatch_once,惰性且线程安全),更贴近 +initialize 的语义。`,
  },
  {
    t: 'atomic 为什么不能保证 NSMutableArray 的线程安全?',
    lv: 2, fq: 2, tags: ['atomic', '线程安全'],
    opt: ['atomic 锁住了所有读写,只是太慢', 'atomic 只保证单次 getter/setter 存取完整,业务是多次存取的组合', 'NSMutableArray 本身是线程安全的', 'atomic 在 ARC 下不可用'],
    ans: 1,
    key: ['atomic 只锁单个 getter/setter 的存取动作', '业务操作是多次存取的组合,锁不住组合语义'],
    a: `**\`atomic\`** 只是在生成的 getter/setter 外加一把自旋锁,保证**单次读或写**不会"读到撕裂的指针"。

**为什么仍然不安全**:业务代码的"线程不安全"不是单步,是**多步组合**:

\`\`\`objc
// 两个线程并发执行:
if (self.mutableArray.count > 0) {          // 第 1 步:读(atomic 保护)
    [self.mutableArray removeLastObject];   // 第 2 步:写(atomic 保护)
}
// 线程 A 读完 count=1,切到线程 B 移除,cut 回 A 再移除 → 越界崩溃
\`\`\`

每一步锁各自完好,**组合语义**却完全失控。

**正确做法**:

- 用**业务级**的同步:串行队列、读写锁(barrier)、actor
- 容器尽量用不可变快照传递,\`NSArray\` 替换式更新而非 \`NSMutableArray\` 原地改
- atomic 只是"值不被写撕裂"的保险,不是线程安全证书

**Swift 视角**:Swift 没有 atomic,引导你用 actor/Sendable/不可变值语义消灭这类问题。`,
  },
  {
    t: 'Foundation 容器线程安全吗?怎么优雅地做线程安全的字典?',
    lv: 2, fq: 3, tags: ['线程安全', 'NSDictionary', 'barrier'],
    opt: ['NSMutableArray 是线程安全的', '可变容器读写都不安全,可用并发队列 + barrier 或 actor 保证安全', 'atomic 属性能让容器线程安全', '只要不同时写就绝对安全'],
    ans: 1,
    key: ['不可变容器读安全;可变容器整体都不安全', '并发读 + barrier 写,或 actor 封装'],
    a: `**结论先行**:\`NSArray\`/\`NSDictionary\` 等**不可变**容器读取是安全的(内容不再变);**可变**容器 \`NSMutableArray/Dictionary\` **读写都不线程安全**,并发必崩或数据错乱。

**手写线程安全字典(经典轻考点)**:

\`\`\`swift
final class SafeDict<K: Hashable, V> {
    private var storage: [K: V] = [:]
    private let queue = DispatchQueue(label: "safe.dict", attributes: .concurrent)

    subscript(key: K) -> V? {
        // 读并发 → 读多写少性能最大化
        queue.sync { storage[key] }
    }
    func set(_ value: V, for key: K) {
        // 写独占:barrier 保证写时无人读写
        queue.async(flags: .barrier) { self.storage[key] = value }
    }
}
\`\`\`

**Swift 6 时代**:同样功能,更能拿出手的答案是写成 \`actor SafeDict\`,编译器检查调用点,零锁;但**同步 API 兼容**要素(OC delegate、不方便 await 的地方)仍是 barrier 方案的舞台。

**别踩的坑**:对 \`@synchronized(self.dict)\` 全量包裹虽然正确,但把读也串行化,高并发读写比例失衡,gcd 题里有更细的对比。`,
  },
  {
    t: 'objc_msgSend 完整流程?方法缓存怎么工作?',
    lv: 3, fq: 3, tags: ['objc_msgSend', '消息发送', 'cache_t'],
    opt: ['直接在类的方法列表中线性查找', '先查 cache_t 缓存,再查本类与父类方法列表,失败进入动态解析与消息转发', '找不到方法会静默返回 nil', '方法缓存对性能没有实质影响'],
    ans: 1,
    key: ['缓存 → 当前类方法列表 → 父类链 → 动态解析 → 消息转发', 'cache_t 哈希桶,命中后直接尾调用 IMP'],
    a: `**完整链路**(objc4 源码级):

1. **缓存查找(cache_t)**:按 \`SEL ⊕ class_hash\` 哈希到桶,命中直接 tail-call IMP。这就是热点方法接近 C 函数调用的原因
2. **当前类方法列表**:\`class_rw_t\` 的 methods 有序/二分查,找到插入缓存
3. **superclass 链**:沿父类重复 1:2,直到根类
4. **动态方法解析**:\`+resolveInstanceMethod:\`,给类一次"现在补上实现"的机会
5. **快速转发**:\`-forwardingTargetForSelector:\`,把消息**改投**给另一个对象(如 WeakProxy 利用点)
6. **标准转发**:\`-methodSignatureForSelector:\` + \`-forwardInvocation:\`,拿到 NSInvocation 可任意改造参数/返回值
7. 全部失败:\`-doesNotRecognizeSelector:\` 抛"unrecognized selector"

**cache 与结构**:\`cache_t\` 是哈希桶(开放寻址),容量 2 的幂,扩容时**清空重建**(线程安全靠原子写);\`class_rw_t\` 是运行期可写擦写板,\`class_ro_t\` 是编译期只读模板。

**应答节奏建议**:先给"五步"层(缓存→列表→父→动态解析→转发),面试官追问再拆 cache_t 桶和 rw/ro 的关系。`,
  },
  {
    t: '消息转发三阶段分别在什么场景用?',
    lv: 3, fq: 3, tags: ['消息转发', 'resolveInstanceMethod', 'NSInvocation'],
    opt: ['三个阶段可以任意顺序触发', '动态方法解析 → forwardingTargetForSelector 快速转发 → forwardInvocation 完整转发', '完整转发比快速转发性能更好', '转发失败会静默忽略'],
    ans: 1,
    key: ['动态解析补救类方法缺失;forwardingTarget 做轻量代理;forwardInvocation 做万能拦截', '越往后越强大也越慢'],
    a: `1. **动态方法解析(\`+resolveInstanceMethod:\`)**:返回 YES 前用 \`class_addMethod\` 给这个类**补一条实现**。典型场景:@dynamic 的属性、依赖运行期才知道的实现、延迟加载的处理器
2. **快速转发(\`-forwardingTargetForSelector:\`)**:把消息**换对象原样投**,参数语义不变。典型:WeakProxy 解 Timer 环、门面/组合伪装继承、多继承模拟
3. **完整转发(\`-methodSignatureForSelector:\` + \`-forwardInvocation:\`)**:把消息封装成 \`NSInvocation\` 给你随意处置:改参数、改返回、记录、重发别处。典型:AOP 埋点、JSON RPC、容错兜底

**性能直觉**:1 ≈ 一次性插入缓存,后面走正常路径;2 是一次多跳;3 要构建 invocation 对象,最重。

**Swift 的边界**:纯 Swift 静态/表派发**没有**这条链,要恢复 runtime 能力需继承 NSObject + \`@objc dynamic\`,这也是 Swift 更难以 AOP 的原因(详见 Runtime 分类)。`,
  },
  {
    t: 'NSObject 的 alloc/init 分别做了什么?为什么要分两步?',
    lv: 2, fq: 2, tags: ['alloc', 'init', '对象创建'],
    key: ['alloc 算尺寸 + calloc 清零内存 + 设置 isa;init 负责成员初始化并可返回别的对象', '分开是为了让 init 有机会返回单例/缓存实例/nil'],
    a: `**\`alloc\` 做三件事**:

1. \`class_getInstanceSize\` 算出实例尺寸(按 **8 字节对齐**,最小 16 字节)
2. \`calloc\` 申请并**清零**内存 —— 这就是成员变量默认是 0 / nil / NO 的原因
3. 设置 **isa** 指向类对象(64 位下是 nonpointer isa,顺带初始化引用计数等位域)

此时对象已经是合法对象,但业务状态是空的。

**\`init\` 的职责**:初始化成员、建立不变式,并**返回一个对象** —— 注意签名是 \`- (instancetype)init\`,它**可以返回与 self 不同的对象**。

**为什么必须分两步**(这是考点):正因为 init 能换对象,才可能实现:

- **单例**:\`init\` 返回已存在的共享实例
- **类簇**:\`[[NSString alloc] initWithFormat:]\` 返回的其实是 \`__NSCFString\` 这类私有子类
- **缓存复用**:返回池子里的旧对象
- **失败返回 nil**:\`initWithContentsOfFile:\` 文件不存在时返回 nil

这也解释了为什么**必须写 \`self = [super init]\`**:父类可能给你换了个对象,不接住就会在一块被废弃的内存上继续初始化。

**Swift 对照**:Swift 的两段式初始化(先初始化本类存储属性,再调 super.init,之后才能用 self)是把同样的纪律**编译期强制**了,不再依赖程序员自觉。`,
  },
  {
    t: 'weak 和 assign 修饰对象有什么区别?为什么 delegate 不用 assign?',
    lv: 1, fq: 2, tags: ['weak', 'assign', 'delegate'],
    opt: ['两者完全等价', 'weak 在对象释放后自动置 nil,assign 不会,留下野指针', 'assign 会增加引用计数', 'weak 只能修饰基本类型'],
    ans: 1,
    key: ['weak:不持有 + 对象销毁自动置 nil(安全)', 'assign/unsafe_unretained:不持有也不置 nil → 野指针 → EXC_BAD_ACCESS'],
    a: `**差别只有一句话**:对象释放后,**weak 会被置 nil,assign 不会**。

\`\`\`objc
@property (nonatomic, weak)   id<MyDelegate> safeDelegate;
@property (nonatomic, assign) id<MyDelegate> dangerDelegate;   // ⚠️
\`\`\`

delegate 释放后:

- \`safeDelegate\` → nil,\`[safeDelegate doSomething]\` 是**向 nil 发消息,安全无操作**
- \`dangerDelegate\` → 野指针,指向的内存可能已被别的对象复用,发消息轻则行为诡异,重则 \`EXC_BAD_ACCESS\` 崩溃,而且**崩溃点与真正的错误位置无关**,极难排查

**为什么 assign 还存在**:

- 它是给**基本类型**(NSInteger、BOOL、CGFloat)用的,这些没有引用计数概念
- \`unsafe_unretained\` 是 assign 的对象版,只在极少数场景用:性能极敏感的热路径(省掉 weak 表的读写开销)、或者对象生命周期由 C 层严格管理

**历史背景**:iOS 4 及之前没有 weak,delegate 只能用 assign,那个年代的野指针崩溃有很大比例来自这里。现在**没有任何理由**给对象属性用 assign。

**Swift 对照**:\`weak var\` 必须是 Optional(强制你处理 nil);\`unowned\` 对应 \`unsafe_unretained\` 的思路但带运行时检查,访问已释放对象会明确 crash 而不是读脏数据。`,
  },
]);
