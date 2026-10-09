/* iOS 题宝库 · data/algorithm.js:手写代码与算法 */
'use strict';

QB.add({
  key: 'algorithm', name: '手写代码与算法', icon: 'cAlgo', tint: '#C2255B',
  desc: '白板手写题与 LeetCode 高频,iOS 视角的解法',
}, [
  {
    t: '手写一个 LRU 缓存(要求 O(1)读写,并可加线程安全)',
    lv: 3, fq: 3, tags: ['LRU', '面试手写', '缓存'],
    key: ['哈希表 + 双向链表:O(1) 查与移最近点', '线程安全:actor 封装,或并发读 + barrier 写'],
    a: `**结构**:HashMap 建立 key → 链表节点的映射;双向链表维护"最近使用"次序,**取/写都提到队首,超容逐出队尾**。

\`\`\`swift
final class LRUCache<Key: Hashable, Value> {
    private final class Node {
        let key: Key; var value: Value
        var prev: Node?; var next: Node?
        init(_ k: Key, _ v: Value) { key = k; value = v }
    }
    private var map: [Key: Node] = [:]
    private let capacity: Int
    private var head: Node?    // 最近使用
    private var tail: Node?    // 最久未用

    init(capacity: Int) { self.capacity = max(1, capacity) }

    func value(for key: Key) -> Value? {
        guard let node = map[key] else { return nil }
        moveToFront(node)
        return node.value
    }

    func set(_ value: Value, for key: Key) {
        if let node = map[key] {
            node.value = value
            moveToFront(node)
            return
        }
        let node = Node(key, value)
        map[key] = node
        insertAtFront(node)
        if map.count > capacity, let last = tail {
            map.removeValue(forKey: last.key)
            remove(last)
        }
    }

    private func moveToFront(_ node: Node) { remove(node); insertAtFront(node) }
    private func insertAtFront(_ node: Node) {
        node.next = head; node.prev = nil
        head?.prev = node; head = node
        if tail == nil { tail = node }
    }
    private func remove(_ node: Node) {
        node.prev?.next = node.next
        node.next?.prev = node.prev
        if node === head { head = node.next }
        if node === tail { tail = node.prev }
        node.prev = nil; node.next = nil
    }
}
\`\`\`

**追问**:**线程安全怎么办**?外层包 actor(推荐)或并发读 sync + barrier 写;**持久化怎么搞**?磁盘侧存一份索引,进内存 LRU 只是热层(参考 SDWebImage 磁盘 LRU 思路)。`,
  },
  {
    t: '反转链表(迭代与递归两种写法)',
    lv: 1, fq: 3, tags: ['链表', '反转'],
    key: ['迭代:prev/cur/next 三指针,O(n) 时间 O(1) 空间', '递归:reverse(rest) 之后把 next.next 指向自己'],
    a: `**迭代(更常考)**:

\`\`\`swift
func reverseList(_ head: ListNode?) -> ListNode? {
    var prev: ListNode? = nil
    var cur = head
    while let node = cur {
        let next = node.next
        node.next = prev
        prev = node
        cur = next
    }
    return prev
}
\`\`\`

**递归**:

\`\`\`swift
func reverseList(_ head: ListNode?) -> ListNode? {
    guard let head = head, let next = head.next else { return head }
    let newHead = reverseList(next)
    next.next = head      // 让后继指回我
    head.next = nil       // 我的旧指向断掉
    return newHead
}
\`\`\`

**对答**:迭代 O(n) 时间 O(1) 空间;递归 O(n) 时间 O(n) 栈。说复杂度时给出"递归指针交换的本质一样"。**变体**:反转前 N 个节点、每 K 个一组翻转,都是"处理一段区间指针"的扩展。`,
  },
  {
    t: '两数之和(要求只遍历一次)',
    lv: 1, fq: 3, tags: ['哈希表', '两数之和'],
    opt: ['最优解是 O(n²) 暴力枚举', '用哈希表存差值,一次遍历 O(n) 时间', '必须先排序再双指针', '只能递归求解'],
    ans: 1,
    key: ['哈希表存"差值 → 下标",边遍历边补查', 'O(n) 时间 O(n) 空间'],
    a: `\`\`\`swift
func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
    var seen: [Int: Int] = [:]   // value -> index
    for (i, x) in nums.enumerated() {
        if let j = seen[target - x] {
            return [j, i]
        }
        seen[x] = i
    }
    return []
}
\`\`\`

**话术**:区别于"先全存再查"的两趟哈希,边查边存**只需要一遍**;**如果数组已排序**,最优解变成**双指针** O(1) 空间(左右夹逼)。**变体**:三数之和(排序 + 双指针)、K 数之和(降维成两数)。`,
  },
  {
    t: '检测链表中是否有环?入环点怎么找?',
    lv: 2, fq: 3, tags: ['快慢指针', '链表', '环'],
    key: ['快慢指针:相遇即有环;入环点:相遇后一个回起点,同步走再相遇即入点', '数学:a = c(起点到入点 = 相遇点到入点)'],
    a: `**判环(快慢指针)**:

\`\`\`swift
func hasCycle(_ head: ListNode?) -> Bool {
    var slow = head, fast = head
    while let f = fast, let n = f.next {
        slow = slow?.next
        fast = n.next
        if slow === fast { return true }
    }
    return false
}
\`\`\`

**找入环点**:相遇后,把一个指针放回 head,两指针**同步每次一步**,再次相遇点就是**入环点**。数学依据:起点到入点距离 a、入点到相遇点 b、环长 c。\`2(a+b) = a + b + kc ⇒ a = (k-1)c + (c-b)\`,即起点指针走 a 与相遇指针继续走 c-b 必交于入点。

**应用**:判环是"状态图重复检测"的模型(Floyd 判圈),乌龟/兔子在**重复子序列、链表交点、图连通性**里都有出场。

**变体**:求环长(相遇后慢指针继续走一圈计数)。`,
  },
  {
    t: '最长无重复字符子串(滑动窗口)',
    lv: 2, fq: 3, tags: ['滑动窗口', '字符串'],
    key: ['字典记每个字符最后出现位置,l 直接跳到重复位置+1', 'O(n) 一次遍历'],
    a: `\`\`\`swift
func lengthOfLongestSubstring(_ s: String) -> Int {
    var last: [Character: Int] = [:]
    var l = 0, best = 0
    for (i, ch) in s.enumerated() {
        if let j = last[ch], j >= l { l = j + 1 }   // 收缩左边界到重复后
        last[ch] = i
        best = max(best, i - l + 1)
    }
    return best
}
\`\`\`

**关键**:左边界 \`l\` **只增不减**;当右侧字符 \`ch\` 上次出现在 \`j\` 且 \`j >= l\`(在窗口内),窗口左端直接跳到 \`j + 1\`。**不要在窗口内逐个缩**,那样会变 O(n²)。

**追问**:为什么不需要额外 set?答:**字典里的最后位置就是窗口曾见证据**,比 set + 双指针更省一遍。

**变体**:最小覆盖子串、字母异位词分组、无重复最长替换子串,都是双指针 + 计数器的亲戚。`,
  },
  {
    t: '合并两个有序链表',
    lv: 1, fq: 3, tags: ['链表', '双指针', '哨兵'],
    key: ['dummy 哨兵节点 + 双指针取最小,剩下直接接尾', '递归也一样自然'],
    a: `\`\`\`swift
func mergeTwoLists(_ l1: ListNode?, _ l2: ListNode?) -> ListNode? {
    let dummy = ListNode(0)
    var tail: ListNode? = dummy
    var a = l1, b = l2
    while let x = a, let y = b {
        if x.val <= y.val { tail?.next = x; a = x.next } else { tail?.next = y; b = y.next }
        tail = tail?.next
    }
    tail?.next = a ?? b      // 剩余部分直接接上
    return dummy.next
}
\`\`\`

**要点**:**dummy 哨兵**统一处理"头节点未定"的边界;剩余一段直接链到尾巴(已经有序),不要重新建节点。**递归版**也自然是:"谁小谁当新头,后面递归 merge"。

**追问**:K 路归并(堆 / 分治 merge),**与合并有序数组**(从尾部反向填充,数组版)对比。`,
  },
  {
    t: '用两个栈实现队列(FIFO)',
    lv: 2, fq: 2, tags: ['栈', '队列', '设计'],
    key: ['in-stack 进、out-stack 出;out 空则一次性倒', '摊还 O(1)'],
    a: `\`\`\`swift
struct QueueOfStacks<T> {
    private var inbox: [T] = []
    private var outbox: [T] = []

    mutating func enqueue(_ x: T) { inbox.append(x) }

    mutating func dequeue() -> T? {
        if outbox.isEmpty {
            while let x = inbox.popLast() { outbox.append(x) }  // 一次性倒
        }
        return outbox.popLast()
    }

    var peek: T? {
        return outbox.isEmpty ? inbox.first : outbox.last
    }
}
\`\`\`

**关键**:outbox **倒的决策只在 outbox 空时**,inbox 不进中间拿;单次最坏 O(n)(倒的时候),**摊还 O(1)**(每个元素各进一次、倒一次、出一次)。

**追问**:反过来**用队列实现栈**(每次 push 之后把已有元素转一圈,或出队时再转);以及**最小栈**(辅助栈同步存当前最小)。`,
  },
  {
    t: '二分查找及变体(含旋转数组)',
    lv: 2, fq: 3, tags: ['二分查找', '旋转数组'],
    key: ['中间比较,或区间打折;注意 mid 防溢出、lower/upper 边界', '旋转数组:先判哪半边有序再决定去哪边'],
    a: `**标准(lower_bound:第一个 >= target)**:

\`\`\`swift
func lowerBound(_ a: [Int], _ target: Int) -> Int {
    var l = 0, r = a.count        // [l, r)
    while l < r {
        let m = l + (r - l) / 2   // 防 (l+r) 溢出
        if a[m] < target { l = m + 1 } else { r = m }
    }
    return l
}
\`\`\`

**旋转有序数组搜索(LeetCode 33)**:

\`\`\`swift
func search(_ a: [Int], _ target: Int) -> Int {
    var l = 0, r = a.count - 1
    while l <= r {
        let m = l + (r - l) / 2
        if a[m] == target { return m }
        if a[l] <= a[m] {                   // 左半边有序
            if a[l] <= target && target < a[m] { r = m - 1 } else { l = m + 1 }
        } else {                            // 右半边有序
            if a[m] < target && target <= a[r] { l = m + 1 } else { r = m - 1 }
        }
    }
    return -1
}
\`\`\`

**要点**:不可直接"中间比两边侧移",先**确定哪半边有序**,目标若落在有序半边再二选一半。

**考试习惯**:说出闭区间的开闭统一、mid 防溢出、下界 vs 上界变体。`,
  },
  {
    t: '快速排序手写?时间复杂度与最坏情况?',
    lv: 2, fq: 2, tags: ['快排', '排序'],
    key: ['分区 + 分治,平均 O(n log n),最坏 O(n²)(已排序+基准取端点)', '随机基准或三数取中;就地版本不加空间'],
    a: `\`\`\`swift
func quicksort<T: Comparable>(_ a: inout [T]) {
    guard a.count > 1 else { return }
    func qs(_ lo: Int, _ hi: Int) {
        guard lo < hi else { return }
        let p = partition(lo, hi)
        qs(lo, p - 1); qs(p + 1, hi)
    }
    func partition(_ lo: Int, _ hi: Int) -> Int {
        let pivot = a[hi]
        var i = lo
        for j in lo..<hi {
            if a[j] <= pivot { a.swapAt(i, j); i += 1 }
        }
        a.swapAt(i, hi)
        return i
    }
    qs(0, a.count - 1)
}
\`\`\`

**复杂度**:平均/期望 **O(n log n)**,最坏 **O(n²)**(每次分区只划出一个元素,比如已排序数组 + 基准取端点);**随机基准**或**三数取中**显著压低最坏概率。

**对位**:**不稳定**排序;**归并**稳定 O(n log n) 但要 O(n) 空间;**堆排** O(n log n) O(1) 但不稳定;**TopK 问题**用快排的 partition 思想(quickselect,平均 O(n))或者堆 O(n log k)。

**iOS 长尾**:\`Array.sorted()\` 内部是 introsort(introspective sort,以快排开头、深递归退堆排、小数组切插排),问的话能加分。`,
  },
  {
    t: '二叉树的层序遍历与最大深度(BFS/DFS)',
    lv: 1, fq: 3, tags: ['二叉树', 'BFS', 'DFS'],
    key: ['层序:队列 BFS;深度:递归 DFS(或层序计数)', '前中后序的递归与迭代都要会'],
    a: `**层序遍历(BFS)**:\n\`\`\`swift
func levelOrder(_ root: TreeNode?) -> [[Int]] {
    guard let root = root else { return [] }
    var result: [[Int]] = []
    var queue: [TreeNode] = [root]
    while !queue.isEmpty {
        var level: [Int] = []
        for _ in 0..<queue.count {
            let node = queue.removeFirst()
            level.append(node.val)
            if let l = node.left { queue.append(l) }
            if let r = node.right { queue.append(r) }
        }
        result.append(level)
    }
    return result
}
\`\`\`

**最大深度(DFS)**:\`maxDepth = 1 + max(maxDepth(left), maxDepth(right))\`,终止空节点返 0

**前/中/后序**:递归 trivial;**迭代版**用栈:前序是根先入栈,出栈时先push右再push左;中序是"一路向左压栈,弹出一个访问,再向右走";后序最麻烦(双栈 / prev 指针)。

**对位**:LeetCode iOS 面试更常见的是 BFS/DFS/最近公共祖先(LCA:左右都找到,当前节点即答案)与**是否对称**(左子树镜像 vs 右子树)。`,
  },
  {
    t: '手写一个线程安全的缓存(actor + 字典 + 缓存上限)',
    lv: 3, fq: 3, tags: ['actor', '缓存', '线程安全'],
    key: ['actor 串行化字典读写,遵循 LRU 淘汰并响应内存警告', '对比 barrier 队列方案:actor 省心且 Swift 6 过检'],
    a: `\`\`\`swift
actor SafeCache<Key: Hashable & Sendable, Value: Sendable> {
    private var storage: [Key: (value: Value, lastAccess: Date)] = [:]
    private let capacity: Int
    init(capacity: Int = 200) { self.capacity = capacity }

    func value(for key: Key) -> Value? {
        guard var entry = storage[key] else { return nil }
        entry.lastAccess = Date()
        storage[key] = entry
        return entry.value
    }

    func set(_ value: Value, for key: Key) {
        storage[key] = (value, Date())
        if storage.count > capacity, let oldest = storage.min(by: { $0.value.lastAccess < $1.value.lastAccess })?.key {
            storage[oldest] = nil
        }
    }

    func removeAll() { storage.removeAll() }
}
\`\`\`

**补齐**:

- 内存警告时 \`await cache.removeAll()\`(NotificationCenter 监听)
- **inflight 合并**(同 key 并发下载不重复:存 Task 而非立即存结果,见 actor 重入题)
- 超时过期:存 \`expires\`,读时过期即删

**对照**:\`barrier\` 队列版本见"如何实现读写锁",两种都能满分,能讲清**actor 的收益(隔离域保证、Swift 6 编译过检)**才是新版标准答案。`,
  },
  {
    t: '手写防抖(debounce):GCD 与 Swift Concurrency 两版',
    lv: 3, fq: 2, tags: ['debounce', '手写'],
    key: ['新事件取消旧任务,静默期满才执行', 'GCD:WorkItem cancel + asyncAfter;Async:Task cancel + sleep'],
    a: `**GCD 版**:

\`\`\`swift
final class Debouncer {
    private var item: DispatchWorkItem?
    private let delay: TimeInterval
    private let queue: DispatchQueue
    init(_ delay: TimeInterval, queue: DispatchQueue = .main) { self.delay = delay; self.queue = queue }
    func call(_ block: @escaping () -> Void) {
        item?.cancel()                                    // 取消上一个
        let next = DispatchWorkItem(block: block)
        item = next
        queue.asyncAfter(deadline: .now() + delay, execute: next)
    }
}
\`\`\`

**Swift 并发版**:

\`\`\`swift
actor AsyncDebouncer {
    private var task: Task<Void, Never>?
    func call(_ delay: Duration = .milliseconds(300), _ block: @escaping @Sendable () async -> Void) {
        task?.cancel()
        task = Task {
            try? await Task.sleep(for: delay)
            if !Task.isCancelled { await block() }
        }
    }
}
\`\`\`

**要点与追问**:**第一次立刻执行(leading edge)与最后一次执行(trailing edge)的区别**;**throttle 与 debounce 的差异**(见 Combine 题);**取消是协作式**,\`Task.isCancelled\` 检查不能省;在 SwiftUI 里搜索 \`onChange\` + debouncer,响应式 \`.debounce\` 是 Combine 渠道。`,
  },
  {
    t: '爬楼梯 / 最大子数组和(基础 DP)',
    lv: 1, fq: 2, tags: ['DP', '动态规划'],
    key: ['爬楼梯:f(n)=f(n-1)+f(n-2),滚动变量 O(n) O(1)', '最大子数组和:维护以 i 结尾的最大和 cur,与 ans 全局比较'],
    a: `**爬楼梯**\n\`\`\`swift
func climbStairs(_ n: Int) -> Int {
    if n <= 2 { return n }
    var a = 1, b = 2                     // f(1), f(2)
    for _ in 3...n { (a, b) = (b, a + b) }
    return b
}
\`\`\`

**最大子数组和(Kadane)**:

\`\`\`swift
func maxSubArray(_ nums: [Int]) -> Int {
    var cur = nums[0], best = nums[0]
    for x in nums.dropFirst() {
        cur = max(x, cur + x)      // 起新段 or 接上段
        best = max(best, cur)
    }
    return best
}
\`\`\`

**DP 三步走**(面试公式):**定义状态 → 写转移 → 边界与遍历顺序**。LeetCode 高频:零钱兑换(完全背包,\`dp[i] = min(dp[i-coin]) + 1\`)、最长递增子序列(LIS,\`dp[i] = max(dp[j]) + 1\`,或二分 patience)、编辑距离(二维 DP)。**说复杂度都要给时间/空间**。`,
  },
  {
    t: '找 Bug:指出这段代码的问题(协程/子线程/循环引用)',
    lv: 2, fq: 3, tags: ['找 Bug', '代码评审'],
    key: ['抓三类:子线程冒 UI、闭包循环引用、sync 死锁 / 状态跨 await 失效', '考察点是"识别 + 给出修复模式"'],
    a: `**反面样本 1**:

\`\`\`swift
DispatchQueue.global().async {
    let data = try? Data(contentsOf: url)
    self.label.text = String(data: data!, encoding: .utf8)   // ⚠️
}
\`\`\`

问题:子线程更新 UI;\`data\` 强解;\`self\` 强捕获(异步闭包逃逸持 self,虽不死环但**延长生命周期**且可能已退出页面仍执行)。

**修复**:\`Task { [weak self] in ... await MainActor.run { self?.label.text = ... } }\`,可选安全解包,执行前 check 取消。

**反面样本 2**:

\`\`\`swift
timer = Timer.scheduledTimer(target: self, ...)   // ⚠️ 强持有
\`\`\`

Timer 强持 self,self 持 timer → 循环引用。**修复**:闭包版 timer + \`[weak self]\` 或 WeakProxy。

**反面样本 3**:

\`\`\`swift
func load() {
    DispatchQueue.main.sync { self.data = net() }  // ⚠️ 主线程在主队列 sync,死锁
}
\`\`\`

**修复**:GCD:\`async\` 或串行私有队列 sync 非主队列;并发时代:\`await MainActor.run\` 是可重入的,不存在同形态死锁。

**考察姿态**:说出**问题 → 后果 → 修法**三层,不是指着代码念经。`,
  },
]);
