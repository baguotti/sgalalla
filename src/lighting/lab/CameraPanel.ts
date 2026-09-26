import { DEFAULT_LOOK, LOOK_RANGES, LOOK_SECTIONS } from '../Look';
import type { LabContext } from './LabContext';
import { button, element, LabPanelBox, openSections, section, slider } from './LabUi';

/** The look's sections this panel has: the camera's post-processing. */
const SECTIONS = ['BLOOM AND RAYS', 'CAMERA', 'CRT'];

/** The camera's post-processing: bloom, sun rays, mist, grading, lens effects, CRT. */
export class CameraPanel {
    private readonly ctx: LabContext;
    private readonly box: LabPanelBox;
    private readonly editor = element('div');

    constructor(ctx: LabContext, place: { top: number; left?: number; right?: number }) {
        this.ctx = ctx;
        this.box = new LabPanelBox('CAMERA', place);
        this.box.body.append(this.editor);
        this.box.footer.append(button('Copy settings', () => ctx.copy()), button('Reset panel', () => this.reset()));
        this.build(true);
    }

    setVisible(visible: boolean): void {
        this.box.setVisible(visible);
    }

    destroy(): void {
        this.box.destroy();
    }

    private build(first = false): void {
        const look = this.ctx.lighting.look;
        const save = () => this.ctx.save();
        const open = openSections(this.editor);
        this.editor.replaceChildren(...LOOK_SECTIONS.filter(([title]) => SECTIONS.includes(title)).map(([title, keys], i) =>
            section(title, first ? i === 0 : open.has(title),
                ...keys.map(key => slider(key, LOOK_RANGES[key], look[key], value => look[key] = value, save, DEFAULT_LOOK[key])))));
    }

    private reset(): void {
        const look = this.ctx.lighting.look;
        for (const [title, keys] of LOOK_SECTIONS) {
            if (!SECTIONS.includes(title)) continue;
            for (const key of keys) look[key] = DEFAULT_LOOK[key];
        }
        this.build();
        this.ctx.save();
    }
}
