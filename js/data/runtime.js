/* iOS 题宝库 · data/runtime.js:Runtime 体系 */
'use strict';

QB.add({
  key: 'runtime', name: 'Runtime', icon: 'cRuntime', tint: '#A83FC6',
  desc: '对象模型、消息机制、KVO/KVC 与 swizzling',
}, [
  {
    t: '实例对象、类对象、元类三者的关系?画一下 isa 走向。',
    lv: 2, fq: 3, tags: ['isa', '元类', '对象模型'],
    opt: ['实例的 isa 指向元类', '实例 isa→类,类 isa→元类,元类 isa→根元类(根元类 isa 指向自己)', '类方法存在类对象的方法列表里', '元类没有 superclass 链'],
    ans: 1,
    key: ['实例 isa→类;类 isa→元类;元类 isa→根元类 → 根元类 isa 指向自己', '实例方法存类,类方法存元类'],
    a: `**一句话**:一切皆对象,对象的 isa 指向"它的类";类也是对象,类的 isa 指向"元类";元类的 isa 统一指向根元类(NSObject 的元类),根元类的 isa 指向**自己**,环闭。

**两条链别混**:

- **isa 链**(问"我是谁"):实例 → 类 → 元类 → 根元类 → 自身
- **superclass 链**(问"我爸是谁"):子类 → 父类 → ... → NSObject → nil;
  元类的 superclass 也有链:子元类 → 父元类 → **根元类 → NSObject**(注意根元类的 superclass 指向 NSObject 类,这是 isKindOfClass 经典题的机关)

**方法表位置**:**实例方法**存在**类对象**的方法列表,**类方法(+方法)**存在**元类**的方法列表。所以 \`object_getClass(obj)\` 才能拿到方法表入口。

**应答话术**:先给"一切皆对象、isa 指类、类有元类、根元类自指"四句话骨架,能画两条链就满分。`,
  },
  {
    t: 'KVO 的实现原理?为什么 Swift 属性默认不能被 KVO?',
    lv: 2, fq: 3, tags: ['KVO', 'isa swizzling', 'NSKVONotifying'],
    opt: ['KVO 通过 Method Swizzling 交换 setter 实现', 'KVO 动态生成 NSKVONotifying_ 子类并把对象 isa 指向它', 'Swift 属性天然支持 KVO', 'KVO 不依赖 Objective-C runtime'],
    ans: 1,
    key: ['动态生成 NSKVONotifying_ 子类 + isa 偷换 + 重写 setter 调 will/didChange', '依赖 OC runtime 消息派发,纯 Swift 属性默认静态派发不经过'],
    a: `**三步原理**:

1. 第一次 \`addObserver\` 时,runtime 给被观察对象的类**动态生成子类** \`NSKVONotifying_XXX\`,把对象的 **isa 指向该子类**(isa-swizzling),外部无感
2. 子类**重写被观察 key 的 setter**:原实现前后包上 \`willChangeValueForKey:\` / \`didChangeValueForKey:\`,触发观察者回调;同时重写 \`-class\` 返回原类隐藏痕迹,重写 \`-dealloc\` 清理
3. \`observeValueForKeyPath:\` 收到变化,带 oldValue/newValue/context

**推论与陷阱**:

- 手动触发:直接 \`_ivar = x\` 不走 setter,KVO 静默,要么 \`will/didChangeValueForKey\` 手动包,要么 \`setValue:forKey:\` 走 KVC
- Swift 的属性默认静态/表派发,**不走 objc_msgSend**,所以要么继承 NSObject + \`@objc dynamic\`,要么用 Swift 原生的 \`@Published\` / \`@Observable\` 替代
- KVO 缺陷:观察者**不移除**在对象销毁后回调会崩(iOS 11 前典型 crash)、嵌套触发、回调里没有"为什么变"的上下文;新代码建议 Combine / Observation`,
    deep: `**追问:自动 vs 手动通知**

\`+automaticallyNotifiesObserversForKey:\` 返回 NO 可关闭自动通知,配合 will/did 包裹自定义变更(如批量更新只发一次);依赖型属性用 \`+keyPathsForValuesAffectingValueForKey:\` 声明 fullName 依赖 firstName/lastName。`,
  },
  {
    t: 'KVC 的赋值过程?setValue:forKey: 的查找顺序?',
    lv: 2, fq: 2, tags: ['KVC', 'setValue', '键值编码'],
    key: ['setter → _key → _isKey → key → isKey → setValue:forUndefinedKey', 'valueForKey 走 getter → _getKey → getKey → key → isKey → ivar'],
    a: `**\`setValue:forKey:\` 查找顺序**:

1. 按序找 setter:\`set<Key>:\` → \`_set<Key>:\`,找到即调
2. 没找到且 \`+accessInstanceVariablesDirectly\` 返回 YES:按序找成员变量 \`_<key>\` → \`_is<Key>\` → \`<key>\` → \`is<Key>\`,直接写 ivar
3. 都没有:走到 \`setValue:forUndefinedKey:\`,默认抛异常,可以重写过兜底

**\`valueForKey:\`** 对应:\`get<Key>\` → \`<key>\` → \`is<Key>\` → \`_get<Key>\` → \`_<key>\` → ivar,失败进 \`valueForUndefinedKey:\`。

**为什么重要**:理解这套顺序才能解释"为什么私有 ivar 也能被 KVC 改"(ivar 路径默认开启)、解释 JSON → Model 工具(KVC 是 MJExtension 这类库的底座)、以及 \`setValuesForKeysWithDictionary\` 批量赋值时未知键的崩溃点。

**Swift**:继承 NSObject 的类才有 KVC;纯 Swift 用 Mirror 反射或 Codable。`,
  },
  {
    t: 'Method Swizzling 的原理和注意事项?',
    lv: 2, fq: 3, tags: ['Method Swizzling', 'AOP', '埋点'],
    opt: ['直接修改方法的源码实现', '交换两个 Method 的 IMP,应在 +load 中配合 dispatch_once 执行', '对纯 Swift 方法同样有效', 'swizzle 只影响当前实例'],
    ans: 1,
    key: ['method_exchangeImplementations 交换两个方法的 IMP', '在 +load + dispatch_once 里做,调用原实现,注意继承与递归'],
    a: `**原理**:\`method_exchangeImplementations(m1, m2)\` 把两个方法的 **IMP 对调**。之后调 \`originalSelector\` 实际跑到新实现,在新实现里"调自己"其实是在调原实现,于是形成"先埋点再走原逻辑"的 AOP。

\`\`\`objc
+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Method a = class_getInstanceMethod(self, @selector(viewWillAppear:));
        Method b = class_getInstanceMethod(self, @selector(log_viewWillAppear:));
        method_exchangeImplementations(a, b);
    });
}
\`\`\`

**注意清单**:

- 放在 \`+load\` + \`dispatch_once\`:+load 在加载时执行且 runtime 锁保证安全,once 防 category 重复加载反复交换
- 新实现里调 \`[self log_viewWillAppear:x]\` 是在调**原实现**,别误以为是递归
- 父类没有实现目标方法时,直接 exchange 会把父类方法的实现挪位置,要先 \`class_addMethod\` 注入占位实现再交换
- **Swift** 侧目标方法必须 \`@objc dynamic\`,否则不经过 runtime

**边界**:全局副作用、可被审核、维护心智负担重,**埋点/热修复除外,业务代码禁用**。`,
  },
  {
    t: '关联对象(Associated Object)的原理?对象销毁后如何处理?',
    lv: 3, fq: 2, tags: ['关联对象', 'objc_setAssociatedObject'],
    key: ['全局 AssociationsManager 哈希表,key=对象地址,value=另一个表', '不记录在对象内存里,dealloc 时由 runtime 统一清理'],
    a: `**结构**:关联对象的值**不存在对象体内**,而是存在 runtime 维护的全局结构 \`AssociationsManager\`(每个进程一份):一张 \`AssociationsHashMap\`,key 是**对象地址**,value 又是对应对象的 \`ObjectAssociationMap\`(key 是你传的 void*,value 是 \`ObjcAssociation\` 即 { policy, value })。

**生命周期**:对象 dealloc 时,runtime 在 \`object_dispose\` 里调 \`_object_remove_assocations\`,把该对象的所有关联值**释放并移除**,所以:

- Category 属性不会有"僵尸关联值"残留泄漏
- 但关联对象不能触发 KVO、不参与归档,只是借用 runtime 这张旁表

**典型坑**:

- 关联**正在 dealloc 中的对象**给别的对象,行为不可预期
- 策略选择:\`OBJC_ASSOCIATION_RETAIN/COPY/ASSIGN\` 要与值语义匹配;用 weak 语义要包装(关联不原生支持 weak 自动置 nil)
- 高频热路径慎用:多两次全局哈希查表和锁,不如真 ivar`,
  },
  {
    t: 'class_rw_t 和 class_ro_t 的区别?分类的方法什么时候合并进去?',
    lv: 3, fq: 2, tags: ['class_rw_t', 'class_ro_t', 'Category 原理'],
    key: ['ro:编译期只读模板;rw:运行期可写擦写板,合并 category/方法新增', 'iOS 13+ attachCategories 多为首次使用时(lazy realize)'],
    a: `**结构分层**:

- **\`class_ro_t\`(read-only)**:编译期写入 Mach-O 的类模板:ivar 布局、初始方法/属性/协议列表。运行期**不可改**
- **\`class_rw_t\`(read-write)**:运行期为类分配的**可写擦写板**,包含方法/属性/协议的**二维数组**,新方法、Category 的方法都往这里 **attach**

**Category 何时合并**:runtime 在 **realizeClass** 时把 \`ro\` 拷成 \`rw\` 骨架,\`attachCategories\` 把各分类的方法数组插到 **rw 方法列表的前面**(\`attachLists\` 头插),所以:

- Category 同名方法"覆盖"主类实现(排在前面先命中)
- 多个 Category 同名时,**编译顺序后加载的排更前**(不可依赖的顺序,别利用)

**时机演进**:早期 +load 阶段就 attach;新版 runtime 把很多工作推迟到**类首次被使用**(lazy realize + map_images 回调分治),这也是 iOS 13 之后启动变快的原因之一。`,
  },
  {
    t: 'isa 指针和 superclass 指针在方法查找中各起什么作用?',
    lv: 3, fq: 3, tags: ['isa', 'superclass', '消息查找'],
    opt: ['isa 决定继承关系,superclass 决定类型', 'isa 决定去哪张方法表查找,superclass 决定找不到时向谁继续找', '两者作用完全相同', '类方法查找不经过 isa'],
    ans: 1,
    key: ['isa 决定"去哪张方法表找",superclass 决定"找不着沿哪向上找"', '类方法为啥能调:类对象的 isa 指元类,其实例方法=类方法'],
    a: `**分工**:

- **isa**:消息接受者的**类型入口**。runtime 从 receiver->isa 拿到方法表缓存 + 方法列表开始查
- **superclass**:当前类的方法表查不到时,沿 superclass 链向父类的 rw 查找,直到根

**两个经典推论**:

1. **类方法为什么能找到**:向类对象发消息,相当于把类对象当**实例**,它自己的 isa 指**元类**,元类的方法列表里存的就是 + 类方法
2. **对象模型经典题**:给 \`NSObject\` 实例发一个**只在 NSObject 类方法中定义**的 + 方法,找不到,因为实例的 isa 指 NSObject **类**,而 + 方法在**元类**里;但反过来,向 **NSObject 类对象**发送 NSObject 的**实例方法**能找到,因为元类的 superclass 链走 nil 后会落到 NSObject 类(isKindOf 套路题同源)

**应答模板**:isa 是"我是谁",superclass 是"我继承谁",cache 是"最近查过的快车"。能现场画 \`实例 → 类 → 元类\` 两层 + 左沿 superclass 链向上,就是高分答案。`,
  },
  {
    t: 'Runtime 在项目里的实用场景有哪些?(说出 4 个以上)',
    lv: 2, fq: 2, tags: ['Runtime 应用', '面试话术'],
    key: ['字典转模型、AOP 埋点、关联属性、防崩溃 forward、归档自动化', '能说出场景 + 原理,也知道何时不该用'],
    a: `**工程地图**:

1. **JSON 字典转模型**:\`class_copyIvarList\` 拿 ivar/type encoding,自动映射并递归嵌套(MJExtension 老做法,正迁移到 Codable)
2. **AOP 埋点/无痕采样**:swizzle viewDidAppear 做 PV 统计,swizzle sendAction 做事件追踪(理解全局副作用)
3. **KVO/isa-swizzling**:系统基础能力,大多框架观察能力的底座
4. **关联对象**:给 category 加存储、给 UIControl 加防抖标记、给 UIView 加业务 tag
5. **容错**:\`forwardInvocation\` 兜底 unrecognized selector 的线上防崩(debug 期仍要报警)
6. **归档自动 NSCoding**、私有 API 调试(仅探索,勿上架)、热修复(JSPath/JSPatch 时代)

**纪律**:Runtime 是"最后工具",有类型安全/编译期方案(Codable、宏、泛型)就不用 runtime,说出来反而是架构成熟度的体现。`,
  },
  {
    t: '什么是 NSProxy?和它相比 NSObject 继承有什么优势?',
    lv: 3, fq: 1, tags: ['NSProxy', '消息转发'],
    key: ['NSProxy 是根类,没有 NSObject 包袱,几乎全部消息都走 forward', '适合做"完美替身":Timer 防环、多继承模拟、懒加载门面'],
    a: `**\`NSProxy\`** 是与 NSObject 平级的**根类**,实现 \`NSObject\` 协议。它**没有** NSObject 那一大坨默认实现(KVC/KVO/各种便利方法),所以**几乎所有消息都会落到 \`forwardInvocation:\`**,是"自定义全量转发"的最佳替身基座。

**经典用途**:

- **WeakProxy 解环**:Timer/CADisplayLink → proxy(弱持 target)→ self,断循环
- **多继承模拟**:proxy 内部按能力路由到多个实现对象
- **懒初始化门面**:消息到达时才真正创建昂贵对象
- **拦截统计**:QMUI/APM 的事件拦截代理

**与继承 NSObject 的区别**:继承实现转发时,**NSObject 已实现的同名方法会优先命中而不走转发**;NSProxy 没有这层"遮挡",转发**可控性拉满**。代价是没有 NSObject 的 \`init\` / KVO 等机制,要自己控制创建和生命周期。`,
  },
  {
    t: '如何给已有的类动态添加方法和属性?(口述实现)',
    lv: 3, fq: 1, tags: ['动态添加', 'runtime API'],
    key: ['方法:class_addMethod + IMP;属性:关联对象模拟 getter/setter', '如果是后来才被消息的类,也可以 resolveInstanceMethod 里补'],
    a: `**加方法**(以给 \`UIView\` 加 \`mh_badgeCount\` 方法为例):

\`\`\`objc
IMP imp = imp_implementationWithBlock(^(UIView *v, NSInteger n){
    objc_setAssociatedObject(v, "badge", @(n), OBJC_ASSOCIATION_RETAIN);
});
class_addMethod([UIView class], @selector(setMh_badgeCount:), imp, "v@:q");
\`\`\`

**加属性**只能靠关联对象模拟(getter/setter 两条方法 + 关联值),**不能真加 ivar**(ivar 布局在编译期/ro 里定死,运行期改类大小会破坏现有实例)

**类型编码**:"v@:q" 依次是 返回值 v(void), self @, _cmd :, 参数 q(long long);写错编码是 addMethod 最常见的坑。

**善后**:动态方法**可被继承、可被交换、参与缓存**,与正常方法无异;想在第一次收到消息时才注入,用 \`+resolveInstanceMethod:\` 的更懒路径(见消息转发题)。`,
  },
  {
    t: 'Swift 类为什么默认没有消息转发?想恢复 runtime 能力怎么办?',
    lv: 2, fq: 3, tags: ['Swift runtime', '@objc dynamic', 'AOP'],
    opt: ['Swift 完全不支持 runtime', 'Swift 走静态/表派发不经 objc_msgSend,需继承 NSObject 且标 @objc dynamic 才恢复', '加 @objc 就能 swizzle', 'Swift 的 struct 也能消息转发'],
    ans: 1,
    key: ['Swift 静态/表派发不走 objc_msgSend,天然没有转发链', '继承 NSObject + @objc dynamic 才回落到完整的 OC runtime'],
    a: `**原因**:Swift 类的实例**不由 \`objc_msgSend\` 派发**(除非满足混编条件),方法调用在编译期就解析成静态地址或 vtable 槽位,**没有** \`resolveInstanceMethod / forwardingTarget / forwardInvocation\` 这条专为 OC 设计的"消息兜底链"。这带来性能与安全,也带走 AOP/元编程的自由。

**恢复完整 runtime 能力的三件套**:

1. 类**(直接或间接)继承 \`NSObject\`**
2. 要动态的目标成员标 **\`@objc\`**(暴露给 OC 选择器空间)
3. 再标 **\`dynamic\`**(强制走消息派发,才能 swizzle / KVO / 转发)

**连带的代价**:方法暴露到 OC 选择器空间带来命名冲突风险;被 swizzle 的 Swift 方法要注意参数类型桥接;KVO 在 Swift 里依旧推荐用 \`@Published\`/Observation 替代。

**2026 视角**:这道题是"为什么 Swift 热修复时代结束"的语言级答案,面试里可以主动把话题从"怎么 swizzle"引到"Swift 用什么替代运行时 hack:宏、Result Builder、泛型特化与 Codable"。`,
  },
  {
    t: 'load 方法为什么会拖慢启动?怎么定位项目里有多少个 +load?',
    lv: 3, fq: 2, tags: ['+load', '启动优化', 'Mach-O'],
    key: ['+load 在 main 之前串行执行,每个都直接计入启动时间', '定位:otool -o 看 __objc_nlclslist / __objc_nlcatlist 段'],
    a: `**为什么疼**:\`+load\` 在 **dyld 加载镜像阶段**就被调用,发生在 \`main()\` 之前,**全部串行**,而且**无论这个类会不会被用到都会执行**。100 个 \`+load\` 各花 1ms,启动就白白多了 100ms,且用户什么也没看到。

**怎么数出来有多少个**:

\`\`\`bash
# non-lazy class(实现了 +load 的类)
otool -o YourApp | grep -A 4 "__objc_nlclslist" | head
# 实现了 +load 的分类
otool -o YourApp | grep -A 4 "__objc_nlcatlist" | head
# 或者直接统计源码(会有漏网的三方库)
grep -rn "^\\s*+\\s*(void)load" --include="*.m" .
\`\`\`

线上工程常见结果是**几十到上百个**,其中大半来自三方 SDK 与老业务的"自动注册"。

**治理路径**(按收益排序):

1. **挪到 \`+initialize\`**:类第一次收消息时才跑,用不到就不花钱
2. **挪到启动任务框架**:按"首帧必需 / 首帧后 / 用时再来"分级(见性能分类)
3. **改用编译期注册**:把 \`+load\` 里的路由注册改成往自定义 Mach-O 段写数据(\`__attribute__((section("__DATA,__myseg")))\`),启动时一次性读段,**零方法调用**
4. **三方 SDK**:能延迟初始化的都别在 didFinishLaunching 同步初始化

**别忘了的细节**:\`+load\` 的调用顺序是**父类 → 子类 → 分类**,且**不走消息发送**(直接函数指针调用),所以分类里的 \`+load\` **不会覆盖**主类的,两个都会执行 —— 这点和普通方法完全相反,是高频追问。`,
  },
  {
    t: 'Method Swizzling 在什么情况下会失效或闯祸?',
    lv: 3, fq: 2, tags: ['Swizzling', '陷阱'],
    opt: ['交换后调用原方法名会无限递归', '父类未实现目标方法时直接交换,会把父类实现挪走影响其他子类', 'swizzle 对 Swift 纯静态派发方法同样有效', '在任何时机 swizzle 都安全'],
    ans: 1,
    key: ['父类没实现就交换 → 污染父类,要先 class_addMethod 再换', 'Swift 方法需 @objc dynamic;重复 swizzle 要 dispatch_once'],
    a: `**四个真实事故场景**:

**1. 父类陷阱(最经典)**:子类没实现 \`viewWillAppear:\`,你 \`class_getInstanceMethod\` 拿到的是**父类的 Method**,交换后等于**改了父类实现**,所有兄弟子类一起中招。

正确写法是先尝试添加:

\`\`\`objc
BOOL added = class_addMethod(cls, originalSEL,
                             method_getImplementation(swizzledMethod),
                             method_getTypeEncoding(swizzledMethod));
if (added) {
    // 子类本来没有,现在添加成功 → 把 swizzled 换成原来的父类实现
    class_replaceMethod(cls, swizzledSEL,
                        method_getImplementation(originalMethod),
                        method_getTypeEncoding(originalMethod));
} else {
    method_exchangeImplementations(originalMethod, swizzledMethod);
}
\`\`\`

**2. 重复交换**:分类被多次加载或 \`+load\` 被调两次,交换两次等于**换回去了**,功能静默失效。必须 \`dispatch_once\` 包裹。

**3. Swift 无效**:纯 Swift 方法走静态/表派发,\`objc_msgSend\` 根本不参与,swizzle 没有任何效果。必须 \`@objc dynamic\` 才行。

**4. 方法名冲突**:自定义的 \`swizzled_xxx\` 撞上别的库的同名方法,或者与系统未来新增的方法重名 —— 一律加**专属前缀**(\`mh_swizzled_\`)。

**时机纪律**:只在 \`+load\` 里做(此时 runtime 加锁且类已加载);\`+initialize\` 可能因为子类而被调多次,不适合。

**结论话术**:埋点、日志这类横切关注点可以用;**业务逻辑一律禁止**,因为它让调用栈与源码对不上,接手的人会崩溃。`,
  },
  {
    t: 'class_rw_t 里为什么还要分 class_rw_ext_t?(iOS 14 后的内存优化)',
    lv: 3, fq: 1, tags: ['class_rw_t', '内存优化', 'runtime 演进'],
    key: ['绝大多数类运行期不会被动态修改,完整 rw 结构是浪费', 'iOS 14 后把很少用的字段拆进 ext,按需分配,省下可观内存'],
    a: `**背景**:每个类在 realize 时都要分配 \`class_rw_t\`。但统计发现,**绝大多数类从头到尾都不会被运行期修改**(不加方法、不加属性),而 \`class_rw_t\` 里的 methods / properties / protocols 这些"可变数组"字段对它们纯属浪费 —— 系统里类的数量是数万级,累计浪费相当可观。

**Apple 的优化**(WWDC20 "Advancements in the Objective-C runtime"):

- \`class_rw_t\` **瘦身**,只保留高频字段(flags、firstSubclass、nextSiblingClass 等)
- 把 methods / properties / protocols 这些**大多数类用不到的**挪进按需分配的 **\`class_rw_ext_t\`**
- 只有当类**真正被动态修改**(attach category、\`class_addMethod\`)时,才分配 ext
- 没有 ext 的类,直接从只读的 \`class_ro_t\` 读方法列表

**收益**:Apple 公布的数据是在 iPhone 上**省下约 14MB** 内存 —— 对系统级优化来说是很大的数字。

**面试价值**:这道题能区分"背过 rw/ro"和"真读过 runtime 演进"。延伸一句更好:同期还做了**relative method lists**(方法列表里存 32 位相对偏移而非 64 位指针,进一步减小体积并让 \`__objc_methlist\` 可以只读共享),思路是一致的 —— **为常见情况优化,为罕见情况留后路**。`,
  },
]);
