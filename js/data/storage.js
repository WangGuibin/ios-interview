/* iOS 题宝库 · data/storage.js:数据持久化 */
'use strict';

QB.add({
  key: 'storage', name: '持久化', icon: 'cStorage', tint: '#A07E5A',
  desc: '沙盒、Keychain、SQLite/CoreData/SwiftData、缓存体系',
}, [
  {
    t: 'iOS 有哪些持久化方案?存储选型怎么定?',
    lv: 1, fq: 3, tags: ['持久化', '选型'],
    opt: ['所有数据都应存进 UserDefaults 以简化代码', '按访问模式选:配置用 UserDefaults,敏感用 Keychain,结构化用数据库,大文件走文件系统', 'Keychain 适合存储大文件', 'Core Data 就是 SQLite 的别名'],
    ans: 1,
    key: ['配置 UserDefaults;敏感 Keychain;文件 JSON/图片走 Files;结构化 SQLite/GRDB;对象图 CoreData;新 Swift 项目 SwiftData', '大对象走文件,别塞 UserDefaults'],
    a: `| 方案 | 擅长 | 不擅长 |
|------|------|--------|
| UserDefaults | 小配置(开关、昵称、音量)KB 级 | 大对象/高频写(全量读入内存 + 写盘同步) |
| **Keychain** | token/密码,加密,**卸载后仍在** | 大数据 |
| 文件(plist/JSON) | 快照、文档、大对象 | 查询与并发 |
| **SQLite**(GRDB/FMDB) | 关系型查询、复杂条件、大数据量 | 对象图/Undo 需要手写 |
| **Core Data** | 对象图、关系、缓存、UI 绑定 | 学习曲线、细粒度控制 |
| **SwiftData**(iOS 17) | Swift 原生、@Model 声明、SwiftUI 一行 @Query | 复杂迁移/老项目 |
| MMKV | 高频小键值(mmap 极速) | 业务结构弱 |
| Realm / 三方 | 对象零拷贝 | 包体积、厂商依赖 |

**对题**:面试官问"用户头像缓存放哪":答 **Library/Caches/…/avatars/\`库的磁盘目录 + 数据库索引**(而不是塞库)。既让系统可清,又有索引可清。

**记住一句话**:**把数据放在"它的访问模式"所属的层**,而不是把一切都推给最大那把锤子。`,
  },
  {
    t: 'App 沙盒目录结构?各目录的用途与 iCloud 备份规则?',
    lv: 1, fq: 3, tags: ['沙盒', 'Documents', 'Library/Caches'],
    opt: ['Documents 不会被 iCloud 备份', 'Library/Caches 会被 iCloud 备份', 'Library/Caches 不被备份且系统可在存储紧张时清空', 'tmp 目录内容会永久保留'],
    ans: 2,
    key: ['Documents 备份;Library/Caches 不备份可清;Preferences 系统管;tmp 随时清', '下载生成的内容放 Caches,防止占用用户 iCloud 空间被审核点名'],
    a: `**目录地图**:

- **Documents/**:用户生成的内容(作品、相册导出),**会被 iTunes/iCloud 备份**;不是用户需要看到的文件**不该放这里**(旧审核条款)
- **Library/Caches/**:**缓存与可再下载内容**,**不备份**,系统在存储紧张时**可清空**(App 未运行时);下载的图片/视频/离线包都来这里
- **Library/Application Support/**:应用内部需要保留但**不可见**的数据(数据库文件、配置),**备份**;对不想备份的大文件用 \`isExcludedFromBackup\` 属性
- **Library/Preferences/**:\`NSUserDefaults\` 的 plist 落盘点,**不应该**手动改
- **tmp/**:临时文件,**随时清**,用完自己删

**对题**:

- "下载的 3GB 离线视频放 documents 合适吗":**不合适**,备份会白白占用用户 iCloud 配额,放 Caches + 可恢复(重要记录进度另存) 或 Application Support + \`isExcludedFromBackup\`
- 要**应用间共享**:App Group container(\`containerURL(forSecurityApplicationGroupIdentifier:)\`)+ Keychain Access Group`,
  },
  {
    t: 'UserDefaults 的原理?什么时候它不合适?',
    lv: 2, fq: 3, tags: ['UserDefaults', 'plist', '线程安全'],
    opt: ['UserDefaults 适合存储大量结构化数据', '本质是全量读入内存的 plist,只适合 KB 级配置,不适合大对象与高频写', 'synchronize() 必须每次手动调用', 'UserDefaults 不是线程安全的'],
    ans: 1,
    key: ['全量读入内存的 plist 落盘,写操作异步落盘', '大对象、高频写、结构化查询都别用它'],
    a: `**机制**:\`UserDefaults.standard\` 启动时把 \`Library/Preferences/<bundleId>.plist\` **全量读入内存**,读写是内存级的,\`synchronize\` 已废弃(自动定时落盘);**本身线程安全**。

**适用边界**:

- KB 级**配置原子**(开关、计数、昵称、上次同步时间戳)
- **不要**当数据库:大数据(列表/对象序列化大 JSON)、高频写(每次写都标脏,下次落盘大对象浪费 IO)、多扩展共享(App Group suite 也是 plist,不大)
- **读优化**:把多个字段封装成 Codable 的一个 struct 存,**单一 key** 换批更新

**陷阱**:\`register(defaults:)\` 是**运行时默认**,不落盘,优先级最低,别和"已经存过"混淆;

**对题**:

- "UserDefaults 和 keychain 存 token 哪个好":**Keychain**(加密、沙盒外、卸载保留),UserDefaults 只放"用户级别的偏好"`,
  },
  {
    t: 'SQLite / CoreData / GRDB / Realm / MMKV 怎么选?',
    lv: 2, fq: 3, tags: ['数据库选型', 'GRDB', 'Realm', 'MMKV'],
    opt: ['选型只看哪个库星标最多', '按访问模式选:重查询用 GRDB,对象图用 Core Data,高频键值用 MMKV', 'MMKV 支持复杂 SQL 查询', 'Realm 没有任何包体积代价'],
    ans: 1,
    key: ['写查询?GRDB;要对象图/iCloud?CoreData;Swift UI 新项目?SwiftData;高频键值?MMKV', 'ORM 抽象成本与查询灵活是主要矛盾'],
    a: `**横评**:

| 方案 | 模型 | 优势 | 代价 |
|------|------|------|------|
| **GRDB**(SQLite) | SQL + Codable 手工映射 | 查询全权(WAL 并发、复杂 SQL、加密 SQLCipher)、包体积小 | 需要写模型映射与迁移 |
| **Core Data** | 对象图 + 持久化协调器 | Undo、change tracking、NSFetchedResultsController、CloudKit | 学习曲线、模型迁移、不是纯 SQL |
| **SwiftData**(iOS 17) | @Model 宏(Swift 原生) | 声明式模型/@Query 直驱 SwiftUI、@ModelActor 后台 | 复杂迁移/穿越能力仍在补齐 |
| **Realm** | 自研引擎对象 DB | 零拷贝读、Live Object | 包体积、厂商绑定、数据迁移 |
| **MMKV**(mmap) | KV 键值 | 写 = memcpy(内存映射),高频小数据最快 | 无查询、结构弱 |

**选型原则(说给面试官)**:

1. 数据结构强关联、需要**对象视图**:Core Data / SwiftData
2. 重查询(报表/过滤/多表 join)与可控加密:**GRDB**
3. key-value 高频埋点、配置中心冷启动:**MMKV**
4. 老项目已有 Core Data 不会轻易立即迁,渐进把新业务走 SwiftData

**加分**:说出"不要看名字选,看访问模式选"(写多读多、查询复杂度、迁移成本、多进程/小组件共享)。`,
  },
  {
    t: 'Core Data 的多线程正确使用姿势?',
    lv: 3, fq: 3, tags: ['Core Data', '并发', 'objectID'],
    opt: ['NSManagedObject 可以自由跨线程传递', 'context 与托管对象都不可跨线程,跨线程传 objectID,后台用 newBackgroundContext + perform', '主 context 适合做大批量导入', 'performAndWait 永远不会死锁'],
    ans: 1,
    key: ['context 不可跨线程,跨线程传 objectID;后台写 privateQueueContext + perform', '合并:automaticallyMergesChangesFromParent'],
    a: `**铁律**:\`NSManagedObjectContext\` 与 \`NSManagedObject\` **都不线程安全**:\n1. context 有\`concurrencyType\`:\`mainQueue\`(主线程 UI) / \`privateQueue\`(各自串行)/ confinement(已废)
2. **跨线程传 \`objectID\`**,再让目标线程里拿 \`context.object(with:)\`,不要直传对象

**常规姿势**:

\`\`\`swift
let bg = container.newBackgroundContext()
bg.perform {
    let p = Post(context: bg)
    p.title = "hi"
    try? bg.save()
}
// 主 context 自动合改动:
mainContext.automaticallyMergesChangesFromParent = true
\`\`\`

**关键 API**:\`perform\`(异步,推荐)/ \`performAndWait\`(同步,小心死锁);\`NSPersistentContainer\` 帮你把 model+coordinator+store 装好;UI 用 \`NSFetchedResultsController\` 监听差量。

**常见坑**:

- 别在主 context 上做**大批量 import**(用 background + batch insert/update/delete)
- 别在主线程做同步 fetch 大结果,用 \`fetchBatchSize\`(分批) + \`includesPendingChanges\` 谨慎
- 多 context 同步的时机:save 完成后,收到 DidSave 通知 → merge;自动合 most 场景够用\n**SwiftData 对应**:\`@ModelActor\` 把整套规则现代化,后台 thread 上操作 model 用 actor 的方法。`,
  },
  {
    t: 'SwiftData 相比 Core Data 有什么进步?@Model 的本质?',
    lv: 2, fq: 2, tags: ['SwiftData', '@Model', 'Swift 宏'],
    key: ['@Model 宏把 class 声明编译成受管模型,免去 xcdatamodeld 可视化建模', '底层仍可能是 CoreData 存储,API 现代化与 SwiftUI 原生绑定'],
    a: `**进步点**:

- **\`@Model\` 宏**(Swift 5.9 宏系统):普通 Swift class 声明即模型,编译期生成持久化背板,**不再手写 xcdatamodeld**;关系、删除规则、唯一约束都用属性宏(\`@Relationship\`、\`@Attribute(.unique)\`)
- **SwiftUI 一等公民**:\`@Query\` 直接绑定 UI,\`#Predicate\` 类型安全的查询
- \`ModelContainer\`(库) + \`ModelContext\`(工作区,有 actor 语义):后台工作用 **\`@ModelActor\`** 声明 actor,编译期就管住并发
- **迁移**:\`VersionedSchema\` 版本分期 +\`SchemaMigrationPlan\` 渐进迁移

**底层与边界**:

- 运行时底层**仍可用 Core Data 的 SQLite** 作为 store,因此两年内的迁移/兼容能力并非"全新自研"
- 复杂场景(细粒度控制、跨进程共享、高度定制 sync)还要回 Core Data(或直接 GRDB)
- 生态还年轻,**能踩的坑照踩**(关系循环大对象遍历、复杂谓词翻译不支持而退化内存过滤)

**面试话术**:\`@Model\` = "\`Codable\` 教会了编译器生成解析代码,\`@Model\` 用同样的宏思路教会编译器生成持久化代码"。`,
  },
  {
    t: '数据库迁移怎么做才安全?',
    lv: 3, fq: 2, tags: ['数据库迁移', 'schema', '备份'],
    key: ['版本链逐版迁移,事务包住,失败可回滚,大库放后台', '迁移代码永久保留,用户可能跨多个版本升级'],
    a: `**分层方案**:

**Core Data 轻量迁移**:属性增删、重命名(\`renamingID\`)、可自动推导;\`NSMappingModel\` + 自定义 policy 处理改类型/拆分实体的大改。

**手写 SQLite/GRDB**:版本号 + **逐版迁移脚本**:

\`\`\`swift
migrator.registerMigration("v7") { db in
    try db.create(table: "attachment") { t in ... }
    try db.alter(table: "post") { t in t.add(column: "summary", .text) }
}
\`\`\`

**工程守则**:

1. **迁移代码永久保留**:用户从 v5 直升 v12,要 v5→v6→…→v12 逐版执行
2. **事务包裹**:全部 DDL/DML 在一个事务里,失败整体回滚,不留半截表
3. **前置备份**:大库迁移前 copy 一份,迁移失败可回退到新策略(删除重建 or 回旧版)
4. **异步 + 进度**:大迁移**绝不能主线程同步**(Watchdog),给进度页并可中断续迁
5. **迁移演练**:CI 上跑 v旧 → v新 的回归,用历史真实数据验证

**谈论**:讲"跳过中间版的代价计算"、"跨版本的边界条件(type change + 默认值回填)"会显出你真的干过。`,
  },
  {
    t: 'Keychain 的特点?为什么卸载 App 后数据还在?',
    lv: 2, fq: 3, tags: ['Keychain', '安全', '卸载保留'],
    opt: ['Keychain 数据存在 App 沙盒里', '卸载 App 后 Keychain 数据立即被清除', 'Keychain 是系统级加密存储,不随 App 沙盒删除', 'Keychain 适合存大文件'],
    ans: 2,
    key: ['加密存储于系统独立区域,不随 App 沙盒删除', 'Access Group 实现同厂商多 App 共享'],
    a: `**要点**:

- **系统级加密存储**(安全协处理器支持的 AES-GCM,硬加密),数据**不在 App 沙盒**(在 \`/private/var/Keychains\` 系统库)
- **卸载 App 不自动删除**(同一设备仍保留;Wipe/还原才清),**token/密钥类应放这里**
- \`kSecAttrAccessible\` 控制可访问性:\`WhenUnlocked\`、\`AfterFirstUnlock\`、\`WhenPasscodeSetThisDeviceOnly\`(换机不迁移)
- \`kSecAttrSynchronizable\` 可进 iCloud Keychain 同步;**Access Group**(同团队 ID)实现"主 App 与扩展/同厂商间共享 token

**API 注意**:\`SecItemAdd/CopyMatching/Update/Delete\` 是老 C API,工程上常用封装(\`KeychainAccess\`、SAMKeychain);**Service**(对应用户可见的"account")要稳定,别随 version 变。

**典型坑**:

- 装了再删掉 App 的"首次启动"感知要用 Keychain 做(Flag 存 keychain,卸载重装后仍存在 → 不是真首次)
- 生物识别绑 Keychain(\`SecAccessControlCreateWithFlags\` + LAContext),FaceID 解锁读取是高安全存储范式

**面试链接**:敏感数据的四件套:**存 Keychain / 传 HTTPS+Pinning / 显 遮罩 / 内存尽快清零**。`,
  },
  {
    t: '两级缓存(内存+磁盘)怎么设计?NSCache 有啥特点?',
    lv: 2, fq: 3, tags: ['缓存', 'NSCache', 'LRU'],
    opt: ['只用内存缓存即可,磁盘太慢', '内存用 NSCache(自动响应内存警告),磁盘用 LRU + 容量上限 + 过期策略', 'NSCache 不是线程安全的', '缓存不需要设置容量上限'],
    ans: 1,
    key: ['L1 内存(NSCache 快)+ L2 磁盘(大)+ L3 网络,LRU + 过期 + 容量', 'NSCache:线程安全、内存警告自动清、countLimit/totalCostLimit'],
    a: `**三级缓存架构**(图片库 SOP):

\`\`\`
URL → L1 内存缓存(解码后位图,小) → L2 磁盘缓存(原始数据/缩略图,大,LRU+TTL) → L3 网络下载
\`\`\`

**关键设计点**:

- **内存层**:\`NSCache\`,系统**内存警告自动逐出**,\`countLimit\`(件数) + \`totalCostLimit\`(估算成本,比如字节做 cost);**线程安全**(可直接并发放取)
- **磁盘层**:文件存 \`Library/Caches\` + **元数据索引**(SQLite/JSON),**LRU**(最近未用淘汰) + **TTL**(过期戳) + **容量上限**(总收入触发 GC)
- **键设计**:URL 整 URL hash(避免碰撞与属性泄漏),资源变化版本号并进 key,支持秒传(网络层)
- **预热与降级**:首屏预取、缩略图(size)与高清分版本,弱网降级低清
- **写一致性**:同 URL 并发下载**合并为单个 inflight**,落盘用"临时文件 + rename"保证原子

**NSCache vs 自维护内存字典**:NSCache 帮你 setEvictsObjectsWithDiscardedContent + 警告响应,SDWebImage 内存层就是基于 NSCache 的封装。

**面试升华**:缓存的**命中率指标与失效策略权重**是工程关键,提"按业务给 TTL 编码进 ETag/revalidate" 比泛泛而谈"LRU"高一档。`,
  },
  {
    t: 'MMKV 的原理?为什么它比 NSUserDefaults 快?',
    lv: 3, fq: 2, tags: ['MMKV', 'mmap', 'protobuf'],
    key: ['mmap 内存映射把写变成内存拷贝,append-only + protobuf 编码', 'OS 页写回由内核按调,崩溃也不丢已写入页'],
    a: `**核心机制**:

1. **mmap**:把磁盘文件**映射**到进程虚拟地址空间,读写文件**就是读写内存**(无 read/write 系统调用)
2. **append-only**:新值**追加**到文件尾,key 检索对**最新值**(protobuf 编码,二进制紧凑)
3. **页回写由内核管**:写入立即落入页缓存,崩溃也不会丢已复制进页的内容(对比 \`write\` 同步语义)
4. **整理(compact)**:到阈值时全量重写剔除旧值

**对比 UserDefaults**:

| | UserDefaults | MMKV |
|---|---|---|
| 读写路径 | plist 全量反序列化 / 序列化 | 直接 memcpy + protobuf |
| 启动成本 | 全量读入 | 建立映射,O(1) 级进入 |
| 高频写 | 每次 synchronize 大 plist | 微秒级 append |
| 类型 | plist 受限 | protobuf 扩展更好 |

**何时不用**:需要**查询条件/表关系**的场景(MMKV 是 KV 不是 DB);需要严格原子多写事务的(它是单 key 原子+部分 multi)。

**工程案**:增长分析埋点缓冲、调试配置中心、IM 的最近消息快照,都是 MMKV 高频亮相场。`,
  },
  {
    t: 'App Group 之间怎么共享数据?',
    lv: 2, fq: 1, tags: ['App Group', '共享', '扩展'],
    key: ['App Group container 目录 + UserDefaults(suiteName:) + Keychain Access Group', 'Darwin 通知/文件写监听做跨进程事件'],
    a: `**三种共享通道**:

1. **共享文件**:\`FileManager.containerURL(forSecurityApplicationGroupIdentifier: "group.x.y")\`,主 App/Widget/Watch/键盘共用一份文件(数据库/缩略图缓存);需要**多进程读写的 DB 要 WAL + 文件锁**或直接考虑 \`SQLite\` 的多连接
2. **共享偏好**:\`UserDefaults(suiteName: "group.x.y")\`,写配置/开关(App Group UserDefaults 还是 plist,别放大数据)
3. **共享钥匙串**:\`Keychain Access Groups\` entitlement,共享登录态 token

**跨进程事件**:

- **Darwin 通知**(CFNotificationCenterGetDarwinNotifyCenter):双向粗粒度"有变化"信号,**不带数据**,事件来后再去读共享存储
- 文件监听(\`DispatchSource.makeFileSystemObjectSource\`)

**工程注意**:多进程**并发写**是共享存储头号 bug 源,建议**写角色收敛**(主 App 独写,扩展只读),必要时 Designate 锁文件;App Group 容量配额别当无限,iCloud 同步走 CloudKit 而不是共享容器。

**对题**:Share Extension 把用户选中的内容交回主 App 的路径 = Share 扩展往**共享容器**写草稿 → Darwin 通知主 App → 主 App 唤起后消费。`,
  },
  {
    t: 'SQLite 的 WAL 模式是什么?对移动端有什么意义?',
    lv: 3, fq: 2, tags: ['SQLite', 'WAL', '并发'],
    opt: ['WAL 让写操作直接覆盖原数据页', 'WAL 把改动先写日志文件,读写可并发,只有写与写互斥', 'WAL 会降低读性能', 'WAL 是 iOS 特有的机制'],
    ans: 1,
    key: ['Write-Ahead Logging:改动先追加进 -wal 文件,读不阻塞写、写不阻塞读', '代价:多出 -wal/-shm 文件,需要 checkpoint 回写'],
    a: `**默认的 rollback journal 模式**:写事务前先把**原页**备份到 journal,再原地改数据库。**读写互斥** —— 写的时候所有读都得等。

**WAL(Write-Ahead Logging)**:改动**追加写入 \`-wal\` 文件**,主库文件暂时不动。读者读主库 + wal 里已提交的部分。结果:

- **读写可以并发**(读不阻塞写,写不阻塞读)
- **只有写与写之间互斥**
- 写入是顺序追加,比随机改页快

**移动端为什么重要**:典型场景是"主线程读列表 + 后台线程写同步数据"。rollback 模式下后台一写,主线程读就被卡住 → 直接掉帧。WAL 基本消灭这类卡顿,所以 **GRDB / FMDB / Core Data 现在默认都开 WAL**。

**代价与注意**:

1. 多出 **\`-wal\` 和 \`-shm\`** 两个文件,**备份/迁移/删除数据库时必须三个一起处理**,只拷 .sqlite 会丢数据
2. wal 会持续增长,靠 **checkpoint** 把内容回写主库。默认自动 checkpoint(1000 页),长事务或持续读会阻止它,导致 wal 膨胀到几百 MB
3. **不能跨进程用在某些沙盒场景**:wal 依赖共享内存(-shm),App Group 跨进程访问要格外小心

**面试加分**:能说出"WAL 让读写并发,但 checkpoint 时机没管好会让 wal 文件失控",说明真的踩过。`,
  },
  {
    t: '大文件/图片该存文件系统还是数据库?边界在哪?',
    lv: 2, fq: 2, tags: ['存储选型', 'BLOB', '文件'],
    key: ['小于 ~100KB 可考虑入库,大文件一律走文件系统,库里只存路径', '数据库存大 BLOB 会让页缓存失效、备份变慢、vacuum 昂贵'],
    a: `**结论先行**:**大文件走文件系统,数据库只存路径与元数据**。SQLite 官方的经验值大约是 **100KB 以下入库反而更快**(省去一次 open/read 系统调用),超过就该落文件。

**为什么大 BLOB 不该入库**:

- **页缓存被冲垮**:一条 5MB 的记录会挤掉大量热数据页,让本来很快的索引查询变慢
- **读写放大**:更新一条带大 BLOB 的行,可能重写整页链
- **备份与迁移变重**:数据库整体体积膨胀,\`VACUUM\` 代价高,iCloud 备份也跟着涨
- **无法利用系统能力**:文件可以用 mmap、可以被系统按需清理(放 Caches)、可以直接给 \`UIImage(contentsOfFile:)\`

**推荐结构**:

\`\`\`
Library/Caches/images/
  ├── a3/f2/a3f2c8...bin        ← 两级目录分片,避免单目录几万文件
数据库 images 表:
  id | url_hash | path | bytes | width | height | created_at | last_used_at
\`\`\`

**两个工程细节**:

1. **两级目录分片**(取 hash 前 4 位):单目录文件过多会让 \`readdir\` 与文件系统索引变慢
2. **元数据在库、内容在盘 → 必须处理不一致**:文件被系统清了但记录还在(读时 fallback 重新下载)、记录删了文件没删(定期 GC 扫孤儿文件)。这是这套方案唯一的真实成本,面试时主动提出来会显得有实战经验。`,
  },
  {
    t: 'UserDefaults 在 App Group 下有什么坑?多进程读写安全吗?',
    lv: 3, fq: 1, tags: ['UserDefaults', 'App Group', '多进程'],
    key: ['suiteName 版本的 UserDefaults 不保证跨进程实时同步', '主 App 与扩展同时写会互相覆盖;KVO 跨进程不触发'],
    a: `**能共享,但不等于"多进程安全"**:

\`\`\`swift
let shared = UserDefaults(suiteName: "group.com.you.app")
\`\`\`

**三个真实的坑**:

1. **不保证实时可见**:主 App 写入后,Widget/扩展进程**可能读到旧值**。底层是 plist 文件 + 各进程的内存缓存,没有强一致协议。iOS 某些版本上 \`synchronize()\` 能缓解,但它已废弃且不可依赖
2. **KVO / didChangeNotification 跨进程不触发**:同进程内改值能收到通知,**另一个进程改的收不到**。要跨进程通知得用 **Darwin 通知**(\`CFNotificationCenterGetDarwinNotifyCenter\`)手动发一个"有变化"的信号,收到后自己重读
3. **并发写互相覆盖**:两个进程同时写不同 key,plist 整体回写时可能丢掉对方的改动

**实践建议**:

- **写者收敛到一个进程**(通常是主 App),扩展只读。这一条能消灭 90% 的问题
- 需要扩展回写(如 Widget 的用户操作)→ 改用**共享文件 + 原子写**(写临时文件再 rename),或直接上 SQLite / MMKV(它们有文件锁与更明确的多进程语义)
- 变更通知统一走 **Darwin 通知 + 主动重读**,不要指望 UserDefaults 自己推

**面试话术**:"App Group 的 UserDefaults 解决的是**可见性**(能不能读到同一份),不解决**一致性**(读到的是不是最新)。要一致性得自己加协议。"`,
  },
]);
