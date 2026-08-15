# LINEリッチメニュー

`rich-menu.png`は、LINE公式アカウントのリッチメニュー用画像です。`set-mob`のデザインシステムに合わせた2500×843pxの3分割レイアウトで、次の導線を設定します。

| エリア | 表示 | 遷移先 |
| --- | --- | --- |
| 左 | 参加登録 | `https://setlog-match-web.vercel.app/?ref=line-rich-menu-register&utm_source=line&utm_medium=rich_menu&utm_campaign=first100` |
| 中 | 参加状況 | `https://setlog-match-web.vercel.app/?ref=line-rich-menu-status&utm_source=line&utm_medium=rich_menu&utm_campaign=first100` |
| 右 | 安全・問い合わせ | `https://setlog-match-web.vercel.app/safety?ref=line-rich-menu-safety&utm_source=line&utm_medium=rich_menu&utm_campaign=first100` |

画像は`python scripts/build-line-rich-menu.py`で再生成できます。LINE側の登録・公開後は、友だち追加済みのアカウントで3エリアをタップし、URLと画面表示を確認します。
