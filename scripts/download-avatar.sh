#!/usr/bin/env bash
# 下载 / 导入数字人模型到 public/（完全离线用途，不依赖 RPM CDN）。
#
# 用法：
#   bash scripts/download-avatar.sh [模型URL或本地路径] [输出文件名]
#
# 第 1 参数支持两种形式：
#   A. 远程 URL（http/https）  -> curl 下载（自动读取 HTTPS_PROXY/HTTP_PROXY）
#   B. 本地 .glb 文件路径       -> 直接复制（跳过网络，适合从 RPM 官网手动导出后传入）
#
# 示例：
#   # 默认：jsDelivr 镜像的 casual 女性 RPM -> public/avatar.glb（含眨眼/说话 morph）
#   bash scripts/download-avatar.sh
#
#   # 从 RPM 编辑器导出的 URL（开代理后可达）下载 -> 覆盖 avatar.glb
#   bash scripts/download-avatar.sh \
#     "https://models.readyplayer.me/64bfa15f0e72c63d7c8a3d4e.glb?pose=A&morphTargets=ARKit,Oculus%20Visemes" \
#     avatar.glb
#
#   # 你已经手动下好一个 glb 文件，直接导入覆盖
#   bash scripts/download-avatar.sh ~/Downloads/my-summer-avatar.glb avatar.glb
#
# —— RPM（readyplayer.me）导出「少衣 + 能说话」模型要点 ——
#   1. 访问 https://readyplayer.me （需代理）创建一个头像。
#   2. 在「Outfit / 穿搭」里选：无袖/背心上衣 + 短裤（即你要的夏装）。
#   3. 进入导出（Download / Export .glb）。关键选项：
#        - Pose: 选 "A" (A-pose，手臂自然下垂；别选 T)
#        - Morph targets / Blendshapes: 勾选 "ARKit" 和 "Oculus Visemes"
#          （这俩决定能不能眨眼 + 口型说话；务必勾上）
#        - Texture / 贴图分辨率：默认即可
#   4. 导出后得到一个 .glb 直链（或浏览器直接下载文件）：
#        - 有直链 -> 作为第 1 参数传给本脚本
#        - 下了文件 -> 把本地路径作为第 1 参数传给本脚本
#   5. 驱动代码（眨眼/口型/眼神）用的就是 ARKit 标准命名，和现有 RPM 通用，
#      覆盖后无需改任何前端代码。
#
# —— 网络提示 ——
#   若目标域名被墙，先开 ClashX 等代理并 export 后运行，curl 自动读取：
#     export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890
#
# 下载 / 复制后，脚本会自动修复 BlendShape（把 mesh.extras.targetNames 复制到标准位置），
# 保证 three.js 能读到眨眼 / 说话的 morph 通道。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public

URL="${1:-https://cdn.jsdelivr.net/gh/TowhidKashem/visage@main/public/female.glb}"
OUT="${2:-avatar.glb}"
DEST="public/$OUT"

# 判断第 1 参数是「本地文件」还是「远程 URL」
if [[ "$URL" != http://* && "$URL" != https://* ]] && [[ -f "$URL" ]]; then
  echo "Local file detected, copying -> $DEST"
  echo "  src: $URL"
  cp "$URL" "$DEST"
else
  echo "Downloading avatar -> $DEST"
  echo "  URL: $URL"
  echo "  proxy: ${HTTPS_PROXY:-${HTTP_PROXY:-（未设置，直连）}}"
  curl -fSL --retry 3 --max-time 180 "$URL" -o "$DEST"
fi

# 修复：部分 GLB 把 morph 名放在 mesh.extras.targetNames，而 three.js 的 GLTFLoader
# 只读 primitives[].targetNames，导致 BlendShape（眨眼/说话）无法被程序驱动。
# 这里把 extras.targetNames 复制到标准位置（已正确的模型会跳过）。
node -e '
const fs=require("fs");
const p=process.argv[1];
if(!fs.existsSync(p)){console.error("模型不存在:",p);process.exit(1);}
let buf=fs.readFileSync(p),off=12,ch=[];
while(off<buf.length){const len=buf.readUInt32LE(off),t=buf.readUInt32LE(off+4);ch.push({t,data:buf.slice(off+8,off+8+len)});off+=8+len;}
const j=JSON.parse(ch[0].data.toString("utf8"));
let n=0;
for(const m of (j.meshes||[])){
  const prs=(m.primitives||[]);
  if(m.extras&&Array.isArray(m.extras.targetNames)){
    for(const pr of prs){
      if(!pr.targetNames){pr.targetNames=m.extras.targetNames;n++;}
    }
  }
}
const jb=Buffer.from(JSON.stringify(j),"utf8");
const pad=b=>{const r=b.length%4;return r?Buffer.concat([b,Buffer.alloc(4-r,0x20)]):b;};
const jc=pad(jb),bc=(()=>{const b=ch[1].data,r=b.length%4;return r?Buffer.concat([b,Buffer.alloc(4-r,0)]):b;})();
const total=12+8+jc.length+8+bc.length,out=Buffer.alloc(total);
out.writeUInt32LE(0x46546C67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
let q=12;out.writeUInt32LE(jc.length,q);out.writeUInt32LE(0x4E4F534A,q+4);jc.copy(out,q+8);q+=8+jc.length;
out.writeUInt32LE(bc.length,q);out.writeUInt32LE(0x004E4942,q+4);bc.copy(out,q+8);
fs.writeFileSync(p,out);
console.log("patched meshes with targetNames:",n);
'
echo "Done. Size: $(du -h "$DEST" 2>/dev/null | cut -f1 || echo '?')"
echo "现在可以 npm run dev 了（模型走本地 /$OUT，完全离线）。"
