# 标准流程实例
参考转账区核心代码，目前是go语言版本

`main.go`文件模拟了前端调用改代码的基本业务流程。

其中，`NewAccount.go`、`GetAddressMsg.go`、`JoinGroup.go`、`SendTX.go`四个文件中实现了四个功能，其余文件是一些会被调用的底层结构体和方法。

更多详细信息参考飞书文档：https://w1yz69fcks.feishu.cn/docx/PPrtdA6mHoN5dlxkCDDcg9OJnZc

### 第一步
> **新建用户**

调用NewAccount.go文件中的NewUser方法新建账户，返回Account，钱包本地需要保存Account信息

### 第二步
> **新用户申请加入指定担保组织10000000**

调用JoinGroup.go文件中的JoinGuarGroup方法，申请加入担保组织，等待回应
RPC返回申请加入担保组织回执信息，调用ReceiveJoinReply方法处理

### 第三步
> **获取钱包地址信息**

调用GetAddressMsg.go文件中的GetAddressMsg方法，获取钱包地址信息，等待回应
RPC返回钱包地址信息，调用ReceiveAddressMsg方法处理

### 第四步
> **发送交易**

先通过前端ui收集构造交易信息，获得BuildTXInfo结构体变量
调用SendTX.go文件中的BuildNewTX方法，构造交易
调用SendTX方法，发送交易

### 第五步
> **获取钱包地址信息，查看交易是否上链**

参考第三步
