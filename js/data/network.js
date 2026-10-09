/* iOS 题宝库 · data/network.js:网络与协议 */
'use strict';

QB.add({
  key: 'network', name: '网络与协议', icon: 'cNetwork', tint: '#3FA2F7',
  desc: 'HTTP/TLS、URLSession、弱网优化与实时通道',
}, [
  {
    t: 'HTTP/1.1、HTTP/2、HTTP/3 的演进对比?',
    lv: 2, fq: 3, tags: ['HTTP/2', 'HTTP/3', 'QUIC'],
    opt: ['HTTP/2 彻底解决了队头阻塞', 'HTTP/2 多路复用但 TCP 层仍有队头阻塞,HTTP/3 基于 QUIC 才彻底解决', 'HTTP/3 仍基于 TCP', 'HTTP/2 使用文本格式传输'],
    ans: 1,
    key: ['H2:二进制分帧+多路复用+HPACK;H3:QUIC on UDP,解决 TCP 层队头阻塞', 'iOS 15+ URLSession 透明支持 H3'],
    a: `| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| 传输层 | TCP | TCP | **QUIC(UDP)** |
| 格式 | 文本 | 二进制分帧 | 二进制分帧 |
| 并发模型 | 每连接一请求(浏览器开行多连接) | 单连接内**多路复用** | 流级真独立 |
| 队头阻塞 | 应用层严重 | **TCP 层仍在** | 彻底解决(单流堵不影响别流) |
| 头部压缩 | 无 | HPACK | QPACK |
| 握手开销 | ≥2 RTT(TCP+TLS) | ≥2 RTT | 1-RTT,回头 0-RTT |
| 网络切换 | 断连重连(4 tuple 变了) | 断连 | **连接迁移**(Connection ID 不变) |

**iOS 支持**:iOS 15+ \`URLSession\` 自动协商 H3(服务端用 \`Alt-Svc: h3=":443"\` 广告或 DNS HTTPS/SVCB 记录),开发者无需改代码;\`URLSessionTaskMetrics\` 的 \`transactionMetrics[].networkProtocolName\` 可验证实际协议(抓包工具抓不到 QUIC)。

**追问**:0-RTT 的重放风险(仅用于幂等请求);H3 在内网/弱网的实测移动网络切换不断连,短视频与直播推流收益显著。`,
  },
  {
    t: 'HTTPS 握手流程(TLS 1.2 / 1.3)?为什么用"混合加密"?',
    lv: 2, fq: 3, tags: ['HTTPS', 'TLS', '证书校验'],
    opt: ['全程使用非对称加密传输数据', '非对称加密负责身份认证与协商对称密钥,后续数据用对称加密', 'TLS 1.3 比 1.2 需要更多 RTT', '证书校验只检查有效期'],
    ans: 1,
    key: ['非对称做事:认证 + 协商对称密钥;对称加密做数据传输(速度快几个数量级)', '1.3:1-RTT,强制前向保密'],
    a: `**TLS 1.2 标准流程(RSA/ECDHE 时代)**:

1. ClientHello:支持的版本/加密套件/随机数 random_C
2. ServerHello + **证书链** + Server 随机数 random_S(+ ECDHE 参数签名)
3. 客户端**校验证书**:链式验签到本地信任根、SAN/CN 域名匹配、有效期、吊销(OCSP Stapling)
4. 用服务器公钥加密 **pre-master secret** 发给服务器(ECDHE 则双方各算共享钥匙)
5. 双方按 (random_C, random_S, pre-master) 各自派生**会话密钥**,后续对称加密(AES-GCM 等)

**为什么混合加密**:非对称(RSA/ECDSA)**慢三个数量级**,只做两件它最擅长的事:**身份认证**与**密钥交换**;业务数据交给 AES 这种**快马**对称算法。

**TLS 1.3 的改进**:把 key_share 压进 ClientHello → **1-RTT**;把恢复走的 PSK 做到 **0-RTT**;废掉弱套件(RC4、CBC、SHA-1),密钥协商只剩 ECDHE,**前向保密强制**;握手大量字段加密,流量分析难。

**客户端的坑**:服务器漏发中间证书,浏览器能 AIA 补链但客户端 SecTrust 不补,发包前用 openssl 验过完整链。`,
  },
  {
    t: 'Charles 抓包的原理?SSL Pinning 为什么能防?',
    lv: 2, fq: 3, tags: ['Charles', '中间人', 'SSL Pinning'],
    opt: ['Charles 能直接破解 TLS 加密', 'Charles 做中间人,前提是客户端信任了它的根证书;SSL Pinning 比对内置证书可防', 'HTTPS 流量无法被抓包', 'SSL Pinning 会让证书永不过期'],
    ans: 1,
    key: ['Charles=中间人:客户端 ↔ Charles ↔ 服务器两段 TLS,前提是客户端信任它的根证书', 'Pinning:比对内置证书/公钥,不只信系统信任库'],
    a: `**抓包 = 中间人(MITM)**:

1. 设备设置代理到 Charles
2. 客户端发起 TLS 时,**Charles 用自己的"根证书"现场签一个假站点证书**给客户端
3. 客户端只要**信任了 Charles 的根证书**(你手动装过并开启完全信任),校验通过
4. Charles 用自己的会话与你 App 单独 TLS,再用真证书与服务器另开一条 TLS,在中间明文看流量

**SSL Pinning(证书锁定)的对抗**:

- 把**服务端证书/公钥**钉进 App,握手时不只信"系统信任库",还要**比对**内置副本

\`\`\`swift
func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    guard let trust = challenge.protectionSpace.serverTrust,
          let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate],
          let key = SecCertificateCopyKey(chain[0]),
          let data = SecKeyCopyExternalRepresentation(key, nil) as Data?,
          data == embeddedPublicKeyData
    else { completionHandler(.cancelAuthenticationChallenge, nil); return }
    completionHandler(.useCredential, URLCredential(trust: trust))
}
\`\`\`

**运维要点**:证书会轮换!内置**一对**(当前 + 下次备用公钥)防锁死;比对公钥而非整证书(证书过期可续签);HSTS、CT 日志等等同层防线可提一句。

**联动**:ATS 是"系统底线"(强制 HTTPS),Pinning 是"应用自查",两者互补。`,
  },
  {
    t: 'TCP 三次握手与四次挥手?为什么是三次 / 四次?',
    lv: 1, fq: 3, tags: ['TCP', '握手', '挥手'],
    opt: ['两次握手即可建立可靠连接', '三次握手让双方确认彼此的初始序列号都被收到', '四次挥手是因为 TCP 是全双工', 'TIME_WAIT 没有任何作用'],
    ans: 1,
    key: ['三次目的:双方确认"我发你收"+交换初始序列号;两次不够', '四次:被动方 ACK 与 FIN 分开发,可能还有数据没传完'],
    a: `**三次握手**:

1. 客户端 SYN(seq=x)
2. 服务端 SYN+ACK(seq=y, ack=x+1)
3. 客户端 ACK(ack=y+1),连接建立

**为什么不是两次**:服务端无法确认"客户端真的收到了自己的 SYN+ACK"(它的初始序列号是否被成功接收),三次后双方的 initial sequence number 都确认OK;**为什么不是四次**:第 2、3 步可以合并。

**四次挥手**:

1. 主动方 FIN(发完了)
2. 被动方 ACK(收到,我**还可能有数据要发**)
3. 被动方 FIN(我也发完了)
4. 主动方 ACK,进入 **TIME_WAIT**(2×MSL)

**四次多的原因**:被动方收到 FIN 时**可能还有数据没传完**,所以 ACK 与 FIN 分两步,先应答,再发自己的 FIN。

**TIME_WAIT 的意义**:让最后一个 ACK 有重发窗口(对方没收到会重发 FIN),同时让"这条连接的旧报文"活到消亡,防止与新连接串包。

**面试摆渡**:移动端的"连接复用"(HTTP keep-alive / H2 单连接多路复用 / QUIC 连接迁移)本质都是**减少这个握手与挥手成本**。`,
  },
  {
    t: 'GET 和 POST 的本质区别?幂等性怎么理解?',
    lv: 1, fq: 3, tags: ['GET', 'POST', '幂等'],
    opt: ['GET 比 POST 更安全,因为参数在 URL 明文', '幂等指同一个请求执行 1 次和 N 次效果一致,GET 幂等 POST 不幂等', 'POST 比 GET 快', 'GET 不能有请求体是协议强制'],
    ans: 1,
    key: ['语义差异(GET 读、POST 写)与规约(幂等/缓存/安全),次要才是参数位置', 'PUT/DELETE 也幂等,幂等 = 同一个请求重复 N 次效果一致'],
    a: `**语义优先**(RFC 9110 规约):

- **GET**:读取,**安全(safe)**且**幂等**,参数走 query,可被缓存/收藏/预取
- **POST**:向资源提交处理,**不幂等也不安全**(下单/发帖),参数走 body
- PUT:全量替换(幂等);PATCH:局部修改;DELETE:删除(幂等)

**幂等性**:同一个请求执行 1 次与执行 N 次,**世界状态一致**。GET/PUT/DELETE 幂等,POST 不幂等(两次 POST 下两单)。

**实践纠偏**:

- "GET 参数在 URL 更安全/POST 在 body 更安全"是**伪命题**,裸 HTTP 都可读
- 浏览器/中间件对 GET 有**缓存/预取/日志**行为,**别把写操作放 GET**(蜘蛛一爬数据全变)
- 参数大小限制是**服务器与客户端**的,不是协议本身
- 前端"防重复提交"就是给 POST 造幂等键(idempotency key),服务端去重

**面试追问**:为什么 H3 的 0-RTT 只允许幂等请求?答案:0-RTT 数据可被重放,只有幂等请求重放不造成新业务效果。`,
  },
  {
    t: 'URLSession 的三种配置与四种 Task?',
    lv: 2, fq: 3, tags: ['URLSession', 'background', 'downloadTask'],
    opt: ['background session 在 App 被杀后任务立即取消', 'background 配置由系统进程接管,App 挂起或被杀后任务仍继续并唤起回调', 'ephemeral 配置会把缓存写入磁盘', 'downloadTask 会把整个文件读进内存'],
    ans: 1,
    key: ['default/ephemeral/background 三种 session 配置;data/upload/download/stream 任务', '后台下载:进程外完成,回来系统唤起回调'],
    a: `**三种配置**:

1. **default**:磁盘缓存、凭据持久化,常规选择
2. **ephemeral**:全部内存态,无痕(隐私场景)
3. **background**:\`URLSessionConfiguration.background(withIdentifier:)\`,**进程的下载/上传由系统(NSURLSessionD)接管**,App 被挂起/杀死任务也**继续**;完成时系统用 identifier **唤起 App**,通过 \`urlSessionDidFinishEvents(forBackgroundURLSession:)\` 延续处理
   - 注意:**上传必须是文件式**(dataTask/uploadTask fromData 不支持),回调全走 delegate,**completionHandler 版本不可用**

**四种 Task**:

- \`dataTask\`:常规请求/响应一次性
- \`uploadTask\`:上传(文件/data,后台只支持文件)
- \`downloadTask\`:下载**写临时文件**(不占内存),resumeData 支持断点续传
- \`streamTask\` / \`webSocketTask\`:双向流与 WebSocket

**Swift 并发**:iOS 15+ \`URLSession.data(from:)\` / \`download(from:)\` / \`bytes(for:)\` 直接 async/throws,与进度 AsyncSequence,记得 \`URLSessionTaskMetrics\` 拿时延分解。

**加分**:统一封装的网络层应该把 configuration、session 复用(创建昂贵)、delegate 队列、信任评估策略收在一处,别让业务裸奔 URLSession.shared。`,
  },
  {
    t: '断点续传与分片上传各怎么做?',
    lv: 3, fq: 3, tags: ['断点续传', 'Range', '分片上传'],
    opt: ['断点续传必须重传整个文件', '断点续传靠 Range 头与 206 Partial Content 实现', '分片上传不需要幂等设计', '分片越大并发越高越好'],
    ans: 1,
    key: ['下载:Range 头 + 206 + resumeData;上传:文件指纹 + 分片幂等 + 合并校验', '4MB 切片、3-4 并发、指数退避'],
    a: `**断点续传(下载)**:

- HTTP \`Range: bytes=offset-\`,服务端回 \`206 Partial Content\`(\`Content-Range\`),客户端**追加写**本地文件
- \`URLSessionDownloadTask\` 被取消拿到 **resumeData**,下次 \`downloadTask(withResumeData:)\` 直接续
- 防资源已变:带 \`If-Range: ETag\`,变了回 200 全量

**分片上传(大文件)**:

1. **切片**:FileHandle 流式读 4MB 一片(移动端甜点),**绝不**整文件读内存
2. **指纹**:采样 hash(首/中/尾 + size)支持**秒传**(已存在直接成功)与断点定位
3. **初始化**会话 → 服务端告知已收分片 → **幂等**协议(hash+index 去重)
4. **并发 3-4 路**滑动窗口(TaskGroup/semaphore),失败指数退避+抖动
5. 全部完成 → **merge 接口**,服务端整体 hash 校验后落盘

**现实条款**:分片接口必须幂等(重传不重复写);弱网环境优先 \`background\` URLSession,进度聚合用单一 reducer 汇总各分片回调;网络从 Wi-Fi 掉 4G 时重试要重建会话,SNI 与 QUIC 要考虑(见 H3 题)。`,
  },
  {
    t: 'Token 过期怎么"无感刷新"?并发请求下如何避免同时刷多次?',
    lv: 3, fq: 3, tags: ['Token 刷新', '401', '无感刷新'],
    opt: ['每个 401 请求各自独立发起一次刷新', '用单飞机制共享同一个刷新 Task,其余请求挂起等待结果后重放', '刷新期间应直接让用户重新登录', 'refresh token 应存在 UserDefaults'],
    ans: 1,
    key: ['单飞刷新:一把锁/Task 保护 refresh,其余请求挂起等待', '401 拦截 → 挂起原请求 → 刷新成功逐个重放'],
    a: `**模型(access token 短寿 + refresh token 长寿)**:

- 请求前判断 accessToken **本地过期时间**(expires_in)提前 N 秒刷新
- 兜底是服务端回 \`401\`(token 失效) 时拦截,刷新后**重放原请求**

**并发下防止"N 个 401 同时刷 N 次"**:**单飞(single-flight)**,所有刷新共享**同一个 Task**:

\`\`\`swift
actor TokenRefresher {
    private var inflight: Task<String, Error>?
    func validToken() async throws -> String {
        if let t = inflight { return try await t.value }   // 等待同一个
        let task = Task { try await realRefresh(refreshToken) }
        inflight = task
        defer { inflight = nil }
        return try await task.value
    }
}
\`\`\`

**请求挂起重放**:401 到达时把原请求**封装成 Continuation** 备用,刷新成功后用新 token **重建请求**(URLSession 不能改 task,原请求返回得新建),再 resume。

**安全细节**:refresh token 进 **Keychain**;refresh 也 401 就**登出**;服务端侧注意 access token 黑名单间隙(登出后短寿内仍可用,业务重要接口做后台二次校验)。

**衔接好的 API 设计**:刷新在拦截器链最前面处理,业务代码**完全无感**,这才是"无感刷新"该有的样子。`,
  },
  {
    t: 'HTTP 缓存机制?客户端和服务器怎么配合?',
    lv: 2, fq: 2, tags: ['HTTP 缓存', 'ETag', 'Cache-Control'],
    key: ['强缓存:Expires/Cache-Control max-age;协商缓存:ETag/If-None-Match 与 Last-Modified', 'URLCache 自动存管,iOS 端要感知磁盘预算'],
    a: `**两类**:

**强缓存**(不发请求):响应头 \`Cache-Control: max-age=3600\`、\`Expires\`。客户端在有效期内**直接用本地副本**,零网络。另有 \`no-store\`(禁存)、\`no-cache\`(每次都先验证)、\`immutable\`(永不变)、\`private/public\` 角色。

**协商缓存**(过期后问一句):

- 客户端带 \`If-None-Match: "etag值"\`,服务端比对:未变 → **304 Not Modified**(只有头,无体);变了 → 200 + 新内容 + 新 ETag
- 简化版:\`If-Modified-Since\` 对 \`Last-Modified\`,精度秒级,只做兜底

**iOS 落地**:\`URLSession\` 默认配 \`URLCache\`(内存+磁盘),策略 \`request.cachePolicy\`:

- \`useProtocolCachePolicy\`(默认,按 HTTP 语义)
- \`reloadIgnoringLocalCacheData\` / \`returnCacheDataElseLoad\` / \`returnCacheDataDontLoad\` 应对"必须新 / 弱网兜底 / 离线优先"

**业务层**:**缓存边界要在设计时定**(avatar 可 max-age 长些 + URL 带版本;feed 必须实时,no-cache);大图像走 SDWebImage/Kingfisher 业务磁盘缓存,与协议缓存 **双层并存,职责不同**。`,
  },
  {
    t: 'DNS 解析是什么流程?HTTPDNS 解决什么痛点?',
    lv: 3, fq: 2, tags: ['DNS', 'HTTPDNS', '劫持'],
    key: ['递归解析:本地缓存 → hosts → 运营商递归 → 根/顶级/权威;HTTPDNS 走 HTTP 接口拿 IP,绕开运营商递归', '解决:跨省跨网调度不准、劫持/投毒、TTL 生效慢'],
    a: `**经典递归流程**:本地 DNS 缓存 → \`/etc/hosts\` → **运营商递归服务器** → 根 → 顶级(.com)→ 权威 NS → A 记录 IP。TTL 决定各级缓存时长。

**移动端的三大痛点**:

1. **LocalDNS 跨网调度**:用户是电信,递归服务器可能查回联通/异省的 CDN 节点 IP,**调度不准** → 慢
2. **劫持/投毒**:LocalDNS 被劫持,广告区块外挂、ARP 投毒、小黑屋给错 IP
3. **TTL 刚性**:服务端"紧急下线某 IP",TTL 不过期,客户端还往坏点撞

**HTTPDNS 方案**:绕过 LocalDNS,**直接 HTTPS 调度中心(domain 或备用 IP)查询权威结果**:

- 返回**按业务线+运营商+地理**精调的 IP 列表 + 短 TTL
- 本地缓存多套答案,轮询与故障转移自己控
- 服务端**SNI 问题**:直接请求 IP 时,TLS SNI/Host 必须保留原域名(URL 用 IP,Host 头/SNI 用域名)

**相关补充**:\`NWPathMonitor\` 检测网络切换后**重跑 DNS 解析**;QUIC 连接迁移下,IP 变了连接还活着(QUIC 的优雅之处);iOS 原生 Encrypted DNS(DoT/DoH profile)是企业合规的另一个方向。`,
  },
  {
    t: 'WebSocket 与 HTTP 取舍?长连接的工程要点?',
    lv: 2, fq: 2, tags: ['WebSocket', '长连接', '心跳'],
    key: ['WS:全双工、低开销长连;HTTP:无状态、短平快、生态成熟', '要点:心跳保活、断线重连退避、消息 ACK 去重、后台降级'],
    a: `**取舍**:

- **HTTP**:单次请求-响应、无状态、CDN/缓存/网关生态极强,适合业务 API、文件传输
- **WebSocket**:HTTP Upgrade 建一次**全双工长连**,帧开销小,适合 IM、实时行情、协同编辑
- iOS 现成件:\`URLSessionWebSocketTask\`(iOS 13+,比 Starscream 三方更省心)

**长连接工程清单**:

1. **心跳保活**:NAT 超时(常 60 到 270s)内发送 ping,解析网络制式动态调间隔(WiFi/4G/5G)
2. **断线重连**:指数退避 + 抖动 + 最大尝试,探测 \`NWPathMonitor\`;用户切网立刻重连
3. **消息可靠性**:唯一 msgID + 双方 ACK + 服务端 seq,客户端按 **seq 补缺口**(见系统设计的 IM 题)
4. **消息去重**:msgID 级去重;乱序重排置 buffer 窗口
5. **降级**:App 进后台系统收走 socket,改 **APNs 推**走离线通知,前后台切换时做会话聚账

**代际演进**:QUIC transport 上的消息流(MoQ / WebTransport)是 2026 方向,弱网下的实时体验上限还在进一步抬。`,
  },
  {
    t: 'cookie / session / token(JWT)的区别?',
    lv: 1, fq: 2, tags: ['认证', 'Cookie', 'JWT'],
    key: ['cookie/session 有状态,服务端存;token 无状态,自己带信息', '移动端 API 主流:Bearer access token + refresh token'],
    a: `- **Cookie**:服务器通过 \`Set-Cookie\` 下发,浏览器/客户端**每次自动带**(注意 WKWebView 独立 cookie 罐)\n- **Session**:服务端给**会话 ID**(放 cookie),**会话状态存服务端内存/Redis**,有状态,扩容要粘性会话或共享存储
- **Token / JWT**:**自包含凭证**(header.payload.signature),服务端**不用存**,验签 + 看 exp 即信;刷新机制解决长登录

**工程影响**:

| | Cookie+Session | Token/JWT |
|---|---|---|
| 会话状态 | 服务端 | 客户端携带,服务端无状态 |
| 退出 | 服务端删 session 立即失效 | 已发 token 在 exp 前仍有效(黑名单/短寿缓解) |
| CSRF | 需防 | 无 cookie 自动带的攻击面 |
| 跨端 | 浏览器原生 | App/Web/小程序通吃 |

**iOS 注意**:WKWebView 与 \`HTTPCookieStorage\` 不是同步魔法的,登录态跨 web 容器要 \`WKHTTPCookieStore\` 双向同步,且写入是**异步**的(有竞态),重要登录态推荐 **Header 注入 token** 而非依赖 cookie。`,
  },
  {
    t: 'WKWebView 的 Cookie 同步问题怎么解?',
    lv: 3, fq: 2, tags: ['WKWebView', 'Cookie 同步'],
    key: ['WKWebView 自有存储与 HTTPCookieStorage 非实时互通', '载入前 setCookie 注入 + 页面变更回写,接受异步竞态'],
    a: `**问题本质**:WKWebView 在 **com.apple.WebKit.Networking** 独立进程跑,cookie 存在自己的 store,**与 NSHTTPCookieStorage 不自动实时同步**;且 WKHTTPCookieStore 的**读写都是异步**。

**常见症状**:原生登录好了,H5 还是未登录态;H5 里登出后原生接口还带着旧 cookie。

**方案**:

1. **注入(载入前)**:取出 \`HTTPCookieStorage\` 的 cookie,\`WKHTTPCookieStore.setCookie\` 写进 web store,**等 completion 再 loadRequest**,避免请求早于写入
2. **回写(变更后)**:\`webView(\_:decidePolicyFor:)\` 里读取响应 \`Set-Cookie\` 写回 native 侧;或监听 \`cookieStoreDidChange\`(iOS 11+)\n3. **实在不稳**:登录态用 **Header token 注入**(JSBridge)与 cookie 解耦,彻底摆脱同步竞态

**附加坑**:跨域名 cookie(SameSite 策略在 iOS 12.2+ 被 ITP 严管)、三方登录跳原生转回的 cookie 延续,\`WKProcessPool\` 共享配置可复用存储。\n\n**工程观点**:能不共享就不共享,真的需要 SSO 全场打通时,**OAuth 授权码 + token 注入**是比 cookie 更硬的路径。
`,
  },
  {
    t: '弱网优化有哪些手段?(说出 6 个)',
    lv: 2, fq: 3, tags: ['弱网', '优化'],
    opt: ['无脑增大超时时间即可', '超时分级与指数退避重试、预连接、HTTPDNS、请求瘦身、缓存兜底、协议升级', '失败后立即无限重试', '只看平均耗时即可评估弱网表现'],
    ans: 1,
    key: ['超时/重试退避、预连接、HTTPDNS、压缩与瘦身、缓存兜底、协议升级 H3', '衡量:失败率与 P95 长尾,不是均值'],
    a: `1. **超时与重试策略**:分阶段超时(建连 5s / 读 10s),重试**指数退避+抖动**,只对**网络类错误**幂等重试,4xx/5xx 不瞎试
2. **预连接/预热**:App 启动或进入页面前预建 \`URLSession\`、预 DNS、预 TLS 握手(长连接复用)
3. **HTTPDNS**:规避 LocalDNS 跨网慢与劫持,调度到最近 CDN 边缘 IP
4. **请求瘦身与合并**:gzip/brotli、字段裁剪(batch 聚合)、图片压缩 WebP/HEIF 与渐进式加载
5. **缓存兜底**:HTTP 协商缓存 + 业务磁盘缓存,首屏**先缓存渲染再增量刷新**
6. **协议升级**:HTTP/3(QUIC)解决 TCP 队头阻塞与网络切换断连,iOS 15+ 透明可用
7. **降级策略**:弱网监测(NWPathMonitor)后切"低码率/低分辨率/关闭动画/关闭自动播放"
8. **观测**:URLSessionTaskMetrics 分阶段耗时(dns/connect/tls/firstByte)做 P95/P99 分析,**问题先量化**`,
  },
]);
