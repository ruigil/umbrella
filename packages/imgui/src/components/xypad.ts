import { Fn } from "@thi.ng/api";
import {
    group,
    line,
    pointInside,
    rect
} from "@thi.ng/geom";
import {
    add2,
    clamp2,
    fit2,
    round2,
    Vec
} from "@thi.ng/vectors";
import { Key, MouseButton } from "../api";
import { IMGUI } from "../gui";
import { textLabel } from "./textlabel";
import { tooltip } from "./tooltip";

const $ = (v: Vec, prec: number, min: Vec, max: Vec) =>
    clamp2(v, round2(v, v, prec), min, max);

export const xyPad = (
    gui: IMGUI,
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    min: Vec,
    max: Vec,
    prec: number,
    val: Vec,
    yUp = false,
    lx: number,
    ly: number,
    label?: string,
    fmt?: Fn<Vec, string>,
    info?: string
) => {
    const maxX = x + w - 1;
    const maxY = y + h - 1;
    const pos = yUp ? [x, maxY] : [x, y];
    const maxPos = yUp ? [maxX, y] : [maxX, y + h - 1];
    const box = rect([x, y], [w, h]);
    const col = gui.textColor(false);
    const hover = pointInside(box, gui.mouse);
    let active = false;
    if (hover) {
        gui.hotID = id;
        const aid = gui.activeID;
        if ((aid === "" || aid === id) && gui.buttons == MouseButton.LEFT) {
            gui.activeID = id;
            active = true;
            $(fit2(val, gui.mouse, pos, maxPos, min, max), prec, min, max);
        }
        info && tooltip(gui, info);
    }
    const focused = gui.requestFocus(id);
    box.attribs = {
        fill: gui.bgColor(hover || focused),
        stroke: gui.focusColor(id)
    };
    const { 0: cx, 1: cy } = fit2([], val, min, max, pos, maxPos);
    gui.add(
        box,
        group(
            {
                stroke: col
            },
            [line([x, cy], [maxX, cy]), line([cx, y], [cx, maxY])]
        ),
        textLabel(
            [x + lx, y + ly],
            col,
            (label ? label + " " : "") +
                (fmt ? fmt(val) : `${val[0] | 0}, ${val[1] | 0}`)
        )
    );
    if (gui.focusID == id) {
        switch (gui.key) {
            case Key.TAB:
                gui.switchFocus();
                break;
            case Key.LEFT:
            case Key.RIGHT: {
                const step =
                    (gui.key === Key.RIGHT ? prec : -prec) *
                    (gui.isShiftDown() ? 5 : 1);
                $(add2(val, val, [step, 0]), prec, min, max);
                return true;
            }
            case Key.UP:
            case Key.DOWN: {
                const step =
                    (gui.key === Key.UP ? prec : -prec) *
                    (yUp ? 1 : -1) *
                    (gui.isShiftDown() ? 5 : 1);
                $(add2(val, val, [0, step]), prec, min, max);
                return true;
            }
            default:
        }
    }
    gui.lastID = id;
    return active;
};
