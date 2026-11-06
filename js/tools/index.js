// Registre des outils.

import { PencilTool, EraserTool, FillTool, PickerTool, ShadeTool, GradientTool } from './paint-tools.js';
import { LineTool, RectTool, EllipseTool } from './shape-tools.js';
import { RectSelectTool, LassoTool, WandTool, MoveTool, HandTool } from './select-tools.js';

export class Tools {
  constructor(app) {
    this.app = app;
    const list = [
      PencilTool, EraserTool, FillTool, PickerTool, ShadeTool, GradientTool, LineTool, RectTool, EllipseTool,
      RectSelectTool, LassoTool, WandTool, MoveTool, HandTool,
    ].map((C) => new C(app));
    this.list = list;
    this.byId = new Map(list.map((t) => [t.id, t]));
    this.current = this.byId.get('pencil');
    this.previous = null;
  }

  get(id) {
    return this.byId.get(id);
  }

  select(id) {
    const t = this.byId.get(id);
    if (!t || t === this.current) return;
    this.current.cancel?.();
    this.current.deactivate?.();
    // changer d'outil pose le contenu flottant (sauf outils de sélection/déplacement)
    if (!['select', 'lasso', 'wand', 'move', 'hand'].includes(id)) this.app.selection.commitFloating();
    this.previous = this.current.id;
    this.current = t;
    this.app.state.tool = id;
    this.app.emit('tool', t);
    this.app.renderer.requestRender();
  }
}
