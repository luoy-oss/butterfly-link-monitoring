# 使用本仓库

## 1.clone本仓库
```bash
git clone https://github.com/luoy-oss/butterfly-link-monitoring.git
```

## 2.将获取到的文件一并复制到butterfly主题下：

> /theme/butterfly/

文件存在路径为：
```yaml
butterfly
│
├─layout
│  └─monitoring.pug
│  │
│  └─includes
│    └─monitoring-layout.pug
│
└─source
    ├─css
    │ └─monitoring.css
    │
    └─js
      └─monitoring.js
```

## 3.在主题配置文件中添加monitoring页面：

> 友链监测: /monitoring || fas fa-link

```yaml
menu:
  首页: / || fas fa-home
  友链: /links/ || fas fa-link
  音乐: /music/ || fas fa-music
  友链监测: /monitoring || fas fa-link
```

## 4.hexo三连

```bash
hexo cl & hexo g & hexo d
```
