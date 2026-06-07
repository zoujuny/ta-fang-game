// 关卡编辑器 (Phaser Scene)
// 玩法:
//   1. 默认从空白画布开始, 玩家点击格子添加拐点
//   2. 第 1 个 waypoint 必须是 (0, X) (画布左边界外的入口), 最后一个必须是 (15, X) (画布右边界外的出口)
//      简化: 第一个 waypoint 强制 col=-1, 最后一个 col=GRID_COLS, row 等于最后真实拐点的 row
//   3. 中间 waypoint 玩家点击格子, (col, row) 整数
//   4. 拖拽已存在的 waypoint 可调整
//   5. 完成时点 "保存" 按钮, 输入名字, 写入 localStorage
//   6. 离开按 "退出"

import Phaser from 'phaser';
import { GRID_COLS, GRID_ROWS, TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from '../config/grid';
import {
  loadUserLevels,
  upsertUserLevel,
  newUserLevelId,
  type UserLevel,
  type UserLevelId,
} from '../levels/editor';

type Mode = 'add' | 'edit';

interface Waypoint { col: number; row: number; }

export class EditorScene extends Phaser.Scene {
  // 正在编辑的关卡 (可能有多个 path, 第一个 = 主路径, 后续 = 备选)
  private paths: Waypoint[][] = [[]];
  private currentPathIdx = 0;
  private editingId: UserLevelId | null = null;
  private name: string = '未命名关卡';

  // 视觉
  private bg!: Phaser.GameObjects.Graphics;
  private pathGfx!: Phaser.GameObjects.Graphics;
  private waypointGfx!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private mode: Mode = 'add';

  // DOM
  private domPanel: HTMLDivElement | null = null;

  constructor() {
    super('EditorScene');
  }

  create() {
    // 背景
    this.bg = this.add.graphics();
    this.drawBackground();

    // 路径层
    this.pathGfx = this.add.graphics().setDepth(1);

    // 拐点层 (用 container 装 circles/text 方便拖拽)
    this.waypointGfx = this.add.container(0, 0).setDepth(2);

    // UI 提示
    this.statusText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT + 22, '', {
      fontSize: '14px', color: '#fff', backgroundColor: '#000', padding: { x: 6, y: 3 },
    }).setOrigin(0.5);

    this.drawAllPaths();
    this.redrawWaypoints();
    this.updateStatus();
    this.buildDomPanel();
    this.refreshUserList();

    // 鼠标点击 (add 模式)
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.onPointerDown(p);
    });
  }

  shutdown() {
    this.teardownDomPanel();
  }

  private drawBackground() {
    this.bg.clear();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        this.bg.fillStyle(0x3a5a40, 1);
        this.bg.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        this.bg.lineStyle(1, 0x1f2e20, 0.6);
        this.bg.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  private drawAllPaths() {
    this.pathGfx.clear();
    const colors = [0xb38b59, 0x60a5fa, 0xfb923c, 0xa855f7];
    for (let pi = 0; pi < this.paths.length; pi++) {
      const path = this.paths[pi];
      if (path.length < 2) continue;
      this.pathGfx.lineStyle(TILE_SIZE, colors[pi % colors.length], pi === this.currentPathIdx ? 1 : 0.6);
      this.pathGfx.beginPath();
      this.pathGfx.moveTo(this.wpX(path[0]), this.wpY(path[0]));
      for (let i = 1; i < path.length; i++) {
        this.pathGfx.lineTo(this.wpX(path[i]), this.wpY(path[i]));
      }
      this.pathGfx.strokePath();
    }
  }

  private redrawWaypoints() {
    this.waypointGfx.removeAll(true);
    for (let pi = 0; pi < this.paths.length; pi++) {
      const path = this.paths[pi];
      for (let i = 0; i < path.length; i++) {
        const wp = path[i];
        const c = this.add.circle(this.wpX(wp), this.wpY(wp), 6, 0xfde047, 1).setStrokeStyle(2, 0x111827);
        c.setData('pathIdx', pi);
        c.setData('wpIdx', i);
        c.setInteractive(new Phaser.Geom.Circle(0, 0, 12), Phaser.Geom.Circle.Contains);
        this.input.setDraggable(c);
        c.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
          c.x = dragX;
          c.y = dragY;
        });
        c.on('dragend', () => {
          const col = Math.round(c.x / TILE_SIZE);
          const row = Math.round(c.y / TILE_SIZE);
          path[i] = { col: clampCol(col), row: clampRow(row) };
          c.x = this.wpX(path[i]);
          c.y = this.wpY(path[i]);
          this.drawAllPaths();
          this.updateStatus();
        });
        this.waypointGfx.add(c);
      }
    }
  }

  private wpX(wp: Waypoint) { return wp.col * TILE_SIZE + TILE_SIZE / 2; }
  private wpY(wp: Waypoint) { return wp.row * TILE_SIZE + TILE_SIZE / 2; }

  private onPointerDown(p: Phaser.Input.Pointer) {
    if (p.y >= GAME_HEIGHT) return;
    if (this.mode !== 'add') return;
    const col = Math.floor(p.x / TILE_SIZE);
    const row = Math.floor(p.y / TILE_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    // 强制: 第一个 waypoint 必须在 (0, row) (col=0, 表示从画布左进入)
    const cur = this.paths[this.currentPathIdx];
    if (cur.length === 0) {
      cur.push({ col: 0, row });
    } else {
      cur.push({ col, row });
    }
    this.drawAllPaths();
    this.redrawWaypoints();
    this.updateStatus();
  }

  private updateStatus() {
    const cur = this.paths[this.currentPathIdx];
    const total = this.paths.reduce((s, p) => s + p.length, 0);
    this.statusText.setText(
      `编辑器 · ${this.name} · 当前路径 ${this.currentPathIdx + 1}/${this.paths.length} · 拐点 ${cur.length} · 总 ${total}  ·  提示: 画布点击加拐点 (首点 col=0) · 拖拽圆点调整 · ESC 返回`,
    );
  }

  public setMode(m: Mode) {
    this.mode = m;
  }

  public addNewPath() {
    if (this.paths[this.currentPathIdx].length === 0) return;
    this.paths.push([]);
    this.currentPathIdx = this.paths.length - 1;
    this.drawAllPaths();
    this.redrawWaypoints();
    this.updateStatus();
  }

  public removeLastWaypoint() {
    const cur = this.paths[this.currentPathIdx];
    if (cur.length === 0) return;
    cur.pop();
    this.drawAllPaths();
    this.redrawWaypoints();
    this.updateStatus();
  }

  public clearCurrentPath() {
    this.paths[this.currentPathIdx] = [];
    this.drawAllPaths();
    this.redrawWaypoints();
    this.updateStatus();
  }

  public setName(name: string) {
    this.name = name.trim() || '未命名关卡';
    this.updateStatus();
  }

  public saveAs(name: string) {
    // 校验: 至少 1 条路径, 每条 ≥ 2 个 waypoint, 最后 col 必须 = GRID_COLS
    for (const p of this.paths) {
      if (p.length < 2) return { ok: false, msg: '每条路径至少需要 2 个拐点' };
      if (p[p.length - 1].col !== GRID_COLS) {
        // 自动补一个终点
        p.push({ col: GRID_COLS, row: p[p.length - 1].row });
      }
    }
    const finalName = name.trim() || '未命名关卡';
    this.name = finalName;
    const id = this.editingId ?? newUserLevelId(finalName);
    const ul: UserLevel = {
      id,
      name: finalName,
      paths: this.paths.map(p => p.map(wp => ({ col: wp.col, row: wp.row }))),
      createdAt: Date.now(),
    };
    upsertUserLevel(ul);
    this.editingId = id;
    this.updateStatus();
    this.refreshUserList();
    return { ok: true, msg: `已保存: ${finalName}` };
  }

  public loadUser(id: UserLevelId) {
    const all = loadUserLevels();
    const u = all.find(l => l.id === id);
    if (!u) return;
    this.editingId = u.id;
    this.name = u.name;
    this.paths = u.paths.map(p => p.map(wp => ({ col: wp.col, row: wp.row })));
    if (this.paths.length === 0) this.paths = [[]];
    this.currentPathIdx = 0;
    this.drawAllPaths();
    this.redrawWaypoints();
    this.updateStatus();
  }

  public newBlank() {
    this.editingId = null;
    this.name = '未命名关卡';
    this.paths = [[]];
    this.currentPathIdx = 0;
    this.drawAllPaths();
    this.redrawWaypoints();
    this.updateStatus();
  }

  public getName() { return this.name; }

  // ============== DOM Panel ==============
  private buildDomPanel() {
    if (document.getElementById('editor-panel')) {
      document.getElementById('editor-panel')!.remove();
    }
    const panel = document.createElement('div');
    panel.id = 'editor-panel';
    panel.style.cssText = `
      position: fixed; top: 88px; right: 12px; width: 240px;
      background: #1f2937; color: #fff; padding: 12px; border-radius: 6px;
      z-index: 20; font-size: 13px; max-height: 70vh; overflow-y: auto;
    `;
    panel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #fde047">关卡编辑器</div>
      <div style="margin-bottom: 6px">
        <input id="editor-name" type="text" placeholder="关卡名" value="${escapeAttr(this.name)}"
          style="width: 100%; padding: 4px; box-sizing: border-box; background: #111827; color: #fff; border: 1px solid #4b5563; border-radius: 3px;" />
      </div>
      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px">
        <button data-act="save" style="${btnStyle(0x22c55e)}">保存</button>
        <button data-act="newpath" style="${btnStyle(0x2563eb)}">新路径</button>
        <button data-act="undo" style="${btnStyle(0x6b7280)}">撤销</button>
        <button data-act="clear" style="${btnStyle(0x6b7280)}">清空</button>
        <button data-act="blank" style="${btnStyle(0x1f2937)}">空白</button>
        <button data-act="exit" style="${btnStyle(0xdc2626)}">退出</button>
      </div>
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px">已保存关卡:</div>
      <div id="editor-list" style="display: flex; flex-direction: column; gap: 4px"></div>
      <div id="editor-msg" style="margin-top: 8px; color: #fde047; font-size: 12px"></div>
    `;
    document.body.appendChild(panel);
    this.domPanel = panel;

    // 事件
    (panel.querySelector('#editor-name') as HTMLInputElement)?.addEventListener('input', e => {
      this.setName((e.target as HTMLInputElement).value);
    });
    panel.querySelectorAll('button[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        const act = (b as HTMLElement).dataset.act!;
        if (act === 'save') {
          const r = this.saveAs(this.name);
          const msg = document.getElementById('editor-msg');
          if (msg) msg.textContent = r.ok ? `✓ ${r.msg}` : `✗ ${r.msg}`;
        } else if (act === 'newpath') {
          this.addNewPath();
        } else if (act === 'undo') {
          this.removeLastWaypoint();
        } else if (act === 'clear') {
          this.clearCurrentPath();
        } else if (act === 'blank') {
          this.newBlank();
        } else if (act === 'exit') {
          this.exitToGame();
        }
      });
    });

    this.input.keyboard?.on('keydown-ESC', () => this.exitToGame());
  }

  private exitToGame() {
    // 切回 GameScene (主画布)
    this.scene.start('GameScene', { onState: ((window as unknown as { __onState: (s: unknown) => void }).__onState) ?? (() => {}) });
  }

  private refreshUserList() {
    const list = document.getElementById('editor-list');
    if (!list) return;
    const all = loadUserLevels();
    list.innerHTML = '';
    if (all.length === 0) {
      list.innerHTML = '<div style="color: #6b7280; font-size: 11px">(暂无)</div>';
      return;
    }
    for (const u of all) {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; gap: 4px; align-items: center;';
      row.innerHTML = `
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${escapeHtml(u.name)}</span>
        <button data-id="${u.id}" data-op="load" style="${btnStyle(0x2563eb, true)}">载</button>
        <button data-id="${u.id}" data-op="play" style="${btnStyle(0x22c55e, true)}">玩</button>
        <button data-id="${u.id}" data-op="del" style="${btnStyle(0x6b7280, true)}">删</button>
      `;
      list.appendChild(row);
    }
    list.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const op = (b as HTMLElement).dataset.op!;
        const id = (b as HTMLElement).dataset.id! as UserLevelId;
        if (op === 'load') this.loadUser(id);
        else if (op === 'play') {
          this.playUserLevel(id);
        }
        else if (op === 'del') {
          import('../levels/editor').then(m => {
            m.deleteUserLevel(id);
            this.refreshUserList();
          });
        }
      });
    });
  }

  private playUserLevel(id: UserLevelId) {
    // 切回 GameScene 并加载该用户关卡
    import('../levels/editor').then(({ loadUserLevels, userLevelToDef }) => {
      const u = loadUserLevels().find(l => l.id === id);
      if (!u) return;
      const def = userLevelToDef(u);
      // 通过全局开关让 GameScene 加载该关卡
      (window as unknown as { __editorLoadLevel: unknown }).__editorLoadLevel = def;
      this.scene.start('GameScene', { onState: ((window as unknown as { __onState: (s: unknown) => void }).__onState) ?? (() => {}) });
    });
  }

  private teardownDomPanel() {
    if (this.domPanel) {
      this.domPanel.remove();
      this.domPanel = null;
    }
  }
}

function clampCol(c: number) { return Math.max(-1, Math.min(GRID_COLS, c)); }
function clampRow(r: number) { return Math.max(0, Math.min(GRID_ROWS - 1, r)); }
function btnStyle(bg: number, small = false): string {
  const s = small ? 'padding: 2px 6px; font-size: 11px;' : 'padding: 4px 8px; font-size: 12px;';
  return `${s} background: #${bg.toString(16).padStart(6, '0')}; color: #fff; border: 1px solid #1f2937; border-radius: 3px; cursor: pointer;`;
}
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]!)); }
function escapeAttr(s: string) { return escapeHtml(s); }
