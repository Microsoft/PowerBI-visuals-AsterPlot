/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

// tslint:disable-next-line
import powerbi from "powerbi-visuals-api";

import IViewport = powerbi.IViewport;

// powerbi.extensibility.utils.chart
import {
    dataLabelManager,
    dataLabelUtils,
    dataLabelInterfaces,
} from "powerbi-visuals-utils-chartutils";
import DataLabelManager = dataLabelManager.DataLabelManager;
import ILabelLayout = dataLabelInterfaces.ILabelLayout;
import LabelEnabledDataPoint = dataLabelInterfaces.LabelEnabledDataPoint;

// d3
import * as d3 from "d3";
import { Arc as SvgArc, arc, line } from "d3-shape";

import { AsterArcDescriptor, ArcDescriptor, Selection } from "./../dataInterfaces";

// powerbi.extensibility.utils.svg
import { CssConstants } from "powerbi-visuals-utils-svgutils";
import ClassAndSelector = CssConstants.ClassAndSelector;
import createClassAndSelector = CssConstants.createClassAndSelector;

import { TooltipEventArgs, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";

import { Helpers } from "./../helpers";

// powerbi.extensibility.utils.type
import { pixelConverter as PixelConverter } from "powerbi-visuals-utils-typeutils";

// powerbi.extensibility.utils.formatting
import { valueFormatter, textMeasurementService, interfaces } from "powerbi-visuals-utils-formattingutils";
import TextProperties = interfaces.TextProperties;


// powerbi.visuals
import ISelectionId = powerbi.visuals.ISelectionId;


class CircleTicksOptions {
    public diffPercent: number;
    public maxHeight: number;
    public ticksCount: number;
}

import {
    AsterDataPoint,
    AsterPlotData
} from "./../dataInterfaces";

import {
    VisualLayout
} from "./../visualLayout";

import {
    AsterPlotSettings,
    CentralLabelsSettings,
    LabelsSettings,
    LegendSettings,
    OuterLineSettings
} from "./../settings";
import { LegendPosition } from "powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces";
import { createLegend } from "powerbi-visuals-utils-chartutils/lib/legend/legend";
// import _ = require("lodash");
import { max, filter, isEmpty } from "lodash-es";


export class DataRenderService {
    private static AsterRadiusRatio: number = 0.9;
    private static AsterConflictRatio: number = 0.9;
    private static AnimationDuration: number = 0;
    private static CenterTextFontWidthCoefficient = 1.9;
    private static AxisTextWidthCoefficient = 1.75;
    private static PixelsBelowAxis = 5;
    private static LabelLinePadding = 4;
    private static ChartLinePadding = 1.02;

    private static AsterSlice: ClassAndSelector = createClassAndSelector("asterSlice");
    private static AsterHighlightedSlice: ClassAndSelector = createClassAndSelector("asterHighlightedSlice");
    private static CenterLabelClass: ClassAndSelector = createClassAndSelector("centerLabel");
    private static labelGraphicsContextClass: ClassAndSelector = createClassAndSelector("labels");
    private static linesGraphicsContextClass: ClassAndSelector = createClassAndSelector("lines");
    private static OuterLine: ClassAndSelector = createClassAndSelector("outerLine");
    private static CircleLine: ClassAndSelector = createClassAndSelector("circleLine");
    private static CircleText: ClassAndSelector = createClassAndSelector("circleText");

    private data: AsterPlotData;
    private settings: AsterPlotSettings;
    private layout: VisualLayout;
    private hasHighlights: boolean;
    private viewportRadius: number;
    private innerRadius: number;
    private outerRadius: number;
    private maxHeight: number;
    private totalWeight: number;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private dataPoints: AsterArcDescriptor[];
    private highlightedDataPoints: AsterArcDescriptor[];
    private arcSvg: AsterArcDescriptor;
    private ticksOptions: CircleTicksOptions;
    private ticksRadiusArray: number[];
    private tickValuesArray: number[];

    constructor(data: AsterPlotData,
        settings: AsterPlotSettings,
        layout: VisualLayout,
        tooltipServiceWrapper: ITooltipServiceWrapper) {

        this.data = data;
        this.settings = settings;
        this.layout = layout;

        this.hasHighlights = data.hasHighlights;
        this.totalWeight = d3.sum(this.data.dataPoints, d => d.sliceWidth);
        this.dataPoints = this.createDataPoints(data, false, this.totalWeight);
        this.highlightedDataPoints = this.createDataPoints(data, true, this.totalWeight);
        this.maxHeight = d3.max(this.data.dataPoints, d => d.sliceHeight);
        this.viewportRadius = Math.min(this.layout.viewportIn.width, this.layout.viewportIn.height) / 2;
        this.tooltipServiceWrapper = tooltipServiceWrapper;

        this.innerRadius = 0.3 * (this.settings.labels.show
            ? this.viewportRadius * DataRenderService.AsterRadiusRatio
            : this.viewportRadius);
        let showOuterLine: boolean = settings.outerLine.show;
        if (showOuterLine) {
            this.ticksOptions = this.calcTickOptions(this.maxHeight);
            this.innerRadius /= this.ticksOptions.diffPercent;
        }

        this.arcSvg = this.getArcSvg(this.innerRadius, this.viewportRadius, this.maxHeight);
        this.outerRadius = max(this.dataPoints.map(d => this.arcSvg.outerRadius()(<any>d, undefined)));

        if (showOuterLine) {
            this.outerRadius *= this.ticksOptions.diffPercent;
            this.ticksRadiusArray = this.calcTicksRadius(this.ticksOptions.ticksCount, this.outerRadius);
            this.tickValuesArray = this.calcTicksValues(this.ticksOptions.ticksCount, this.ticksOptions.maxHeight);
        }
    }

    public drawCenterText(mainGroupElement: Selection<any>): void {
        let centerTextProperties: TextProperties = {
            fontFamily: dataLabelUtils.StandardFontFamily,
            fontSize: PixelConverter.toString(this.settings.label.fontSize),
            text: this.data.centerText
        };

        let centerText: Selection<any> = mainGroupElement.select(DataRenderService.CenterLabelClass.selectorName);

        if (centerText.empty()) {
            centerText = mainGroupElement.append("text").classed(DataRenderService.CenterLabelClass.className, true);
        }

        centerText
            .style("line-height", 1)
            .style("font-weight", centerTextProperties.fontWeight)
            .style("font-size", this.settings.label.fontSize)
            .style("fill", this.settings.label.color)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .text(textMeasurementService.getTailoredTextOrDefault(centerTextProperties, this.innerRadius * DataRenderService.CenterTextFontWidthCoefficient));
    }

    public cleanCenterText(mainGroupElement: Selection<any>): void {
        mainGroupElement.select(DataRenderService.CenterLabelClass.selectorName).remove();
    }

    public renderArcs(slicesElement: Selection<any>, isHighlighted: boolean) {
        let arc: AsterArcDescriptor = this.arcSvg,
            classSelector: ClassAndSelector = this.getClassAndSelector(isHighlighted);

        let selection = slicesElement
            .selectAll(classSelector.selectorName)
            .data(isHighlighted ? this.highlightedDataPoints : this.dataPoints, (d: AsterArcDescriptor, i: number) => {
                return d.data
                    ? (<powerbi.visuals.ISelectionId>d.data.identity).getKey()
                    : <any>i;
            });

        selection
            .exit()
            .remove();

        selection = selection.merge(selection
            .enter()
            .append("path")
            .classed(classSelector.className, true));

        selection
            .attr("fill", d => d.data.fillColor)
            .attr("stroke", d => d.data.strokeColor)
            .attr("stroke-width", d => d.data.strokeWidth)
            .call(selection => {
                return Helpers.needToSetTransition(this.layout.viewportChanged)
                    ? Helpers.setAttr(selection, "d", arc)
                    : Helpers.setTransition(selection, DataRenderService.AnimationDuration, "d", arc);
            });

        this.applyTooltipToSelection(selection);
    }

    private drawGrid(element: Selection<any>, settings: OuterLineSettings): void {
        let outerThickness: string = PixelConverter.toString(settings.thickness),
            color: string = settings.color,
            ticksCount: number = this.ticksRadiusArray.length;

        let circleAxes: Selection<any> = element
            .selectAll("g" + DataRenderService.CircleLine.selectorName)
            .data(this.ticksRadiusArray);

        circleAxes.exit().remove();

        circleAxes = circleAxes.merge(
            circleAxes.enter().append("g").classed(DataRenderService.CircleLine.className, true));

        let circle: any = circleAxes
            .selectAll("circle")
            .data((t) => { return [t]; });

        circle
            .exit()
            .remove();

        circle = circle.merge(circle
            .enter()
            .append("circle"));

        circle
            .attr("r", (d) => d)
            .style("opacity", (d: number, i: number, o: number) => {
                if (o === ticksCount - 1) {
                    return 0;
                } else {
                    return settings.showGrid ? 0.5 : 0;
                }
            })
            .style("stroke", color)
            .style("fill", "none");

        if (settings.showGridTicksValues) {
            let text: any = circleAxes.selectAll("text").data(this.tickValuesArray);
            let textProperties: TextProperties = {
                fontFamily: dataLabelUtils.StandardFontFamily,
                fontSize: PixelConverter.toString(this.settings.outerLine.fontSize)
            };
            text.exit().remove();
            text = text.merge(text.enter().append("text"));
            text.attrs({
                "dy": (d: number, i: number) => { return -this.ticksRadiusArray[i] + DataRenderService.PixelsBelowAxis + (parseInt(this.settings.outerLine.fontSize.toString())); },
                "dx": (d: number, i: number) => { return - textMeasurementService.measureSvgTextWidth(textProperties, this.tickValuesArray[i].toString()) / DataRenderService.AxisTextWidthCoefficient; },
                "text-anchor": "middle"
            })
                .style("font-size", this.settings.outerLine.fontSize)
                .style("fill", this.settings.outerLine.textColor)
                .classed(DataRenderService.CircleText.className, true)
                .text((d: number, i: number) => { return this.tickValuesArray[i]; });

        } else {
            element.selectAll(DataRenderService.CircleText.selectorName).remove();
        }
    }

    private drawOuter(element: Selection<any>) {
        let outlineArc: any = arc()
            .innerRadius(this.settings.outerLine.showStraightLines ? this.innerRadius : this.outerRadius)
            .outerRadius(this.outerRadius);

        let outerThickness: string = this.settings.outerLine.thickness + "px",
            color: string = this.settings.outerLine.color;

        let outerLine = element.selectAll(DataRenderService.OuterLine.selectorName).data(this.dataPoints);
        outerLine.exit().remove();
        outerLine = outerLine.merge(outerLine.enter().append("path"));
        outerLine
            .attr("fill", "none")
            .attr("opacity", 0.5)
            .attr("stroke", color)
            .attr("stroke-width", outerThickness)
            .attr("d", <ArcDescriptor<any>>outlineArc)
            .classed(DataRenderService.OuterLine.className, true);

    }

    public drawOuterLines(element: Selection<any>): void {
        let settings: AsterPlotSettings = this.settings;

        this.drawOuter(element);

        if (settings.outerLine.showGrid || settings.outerLine.showGridTicksValues) {
            this.drawGrid(element, settings.outerLine);
        } else {
            this.cleanGrid(element);
        }
    }

    private cleanGrid(element: Selection<any>): void {
        element.selectAll(DataRenderService.CircleLine.selectorName).remove();
        element.selectAll(DataRenderService.CircleText.selectorName).remove();
        element.selectAll("circle").remove();
    }

    public cleanOuterLines(element: Selection<any>): void {
        element.selectAll(DataRenderService.OuterLine.selectorName).remove();
        this.cleanGrid(element);
    }

    private calcTickOptions(value: number): CircleTicksOptions {
        let val: number = value > 0 ? Math.floor(value) : Math.ceil(value);
        let modifier = 1;

        if (val === 0) {
            for (let i = 0; i < value.toString().length - 3; ++i) {
                modifier *= 10;
                val = value * modifier;
                val = val > 0 ? Math.floor(val) : Math.ceil(val);

                if (val !== 0) {
                    break;
                }
            }
        }

        let step = Math.pow(10, val.toString().length - 1);

        let allTicksCount: number = Math.ceil((val) / step);
        let endPoint: number = allTicksCount * step / modifier;
        let diffPercent: number = endPoint / value;
        let threeTicks: number = 3;
        let twoTicks: number = 2;

        return {
            diffPercent,
            maxHeight: allTicksCount * step * modifier,
            ticksCount: allTicksCount % threeTicks === 0 ? threeTicks : twoTicks // 2 or 3 ticks only needed
        };
    }

    private calcTicksRadius(ticksCount: number, radius: number): number[] {
        let array = [];

        if (ticksCount % 3 === 0) {
            array = [(radius - this.innerRadius) / 3 + this.innerRadius / this.ticksOptions.diffPercent, (radius - this.innerRadius) / 3 * 2 + this.innerRadius / this.ticksOptions.diffPercent, radius];
        } else {
            array = [(radius - this.innerRadius) / 2 + this.innerRadius / this.ticksOptions.diffPercent, radius];
        }

        return array;
    }

    private calcTicksValues(ticksCount: number, outerValue: number): number[] {
        let array = [];

        if (ticksCount % 3 === 0) {
            array = [outerValue / 3, outerValue / 3 * 2, outerValue];
        } else {
            array = [outerValue / 2, outerValue];
        }

        return array;
    }

    private applyTooltipToSelection(selection: any): void {
        this.tooltipServiceWrapper.addTooltip(selection, (tooltipEvent: any) => {
            return tooltipEvent.data.data.tooltipInfo;
        });
    }

    private createDataPoints(data: AsterPlotData, hasHighlight: boolean, totalWeight: number): AsterArcDescriptor[] {
        let pie: any = this.getPieLayout(totalWeight);

        return pie(hasHighlight
            ? data.highlightedDataPoints
            : data.dataPoints);
    }

    private getDataPoints(isHighlight: boolean) {
        return isHighlight ? this.highlightedDataPoints : this.dataPoints;
    }

    private getClassAndSelector(isHighlighted: boolean) {
        return (isHighlighted
            ? DataRenderService.AsterHighlightedSlice
            : DataRenderService.AsterSlice);
    }

    private getPieLayout(totalWeight: number): any {
        return d3.pie<AsterDataPoint>()
            .sort(null)
            .value((dataPoint: AsterDataPoint) => {
                if (!this.totalWeight || !dataPoint || isNaN(dataPoint.sliceWidth)) {
                    return 0;
                }

                return dataPoint.sliceWidth / totalWeight;
            });
    }

    private getArcSvg(innerRadius: number, viewportRadius: number, maxHeight: number): any {
        return arc<AsterArcDescriptor>()
            .innerRadius(innerRadius)
            .outerRadius((arcDescriptor: AsterArcDescriptor, i: number) => {
                let height: number = 0;

                if (this.maxHeight) {
                    let radius: number = viewportRadius - innerRadius,
                        sliceHeight: number = 1;

                    sliceHeight = arcDescriptor
                        && arcDescriptor.data
                        && !isNaN(arcDescriptor.data.sliceHeight)
                        ? arcDescriptor.data.sliceHeight
                        : sliceHeight;

                    height = radius * sliceHeight / maxHeight;
                }

                // The chart should shrink if data labels are on
                let heightIsLabelsOn = innerRadius + (this.settings.labels.show ? height * DataRenderService.AsterRadiusRatio : height);
                // let heightIsLabelsOn = innerRadius + height;
                if (this.ticksOptions) {
                    heightIsLabelsOn /= this.ticksOptions.diffPercent;
                }

                // Prevent from data to be inside the inner radius
                return Math.max(heightIsLabelsOn, innerRadius);
            });
    }

    public renderLabels(labelsElement: Selection<any>, isHighlight: boolean) {
        let dataPoints: AsterArcDescriptor[] = isHighlight ? this.highlightedDataPoints : this.dataPoints;
        if (!this.data.hasHighlights || (this.data.hasHighlights && isHighlight)) {
            let labelRadCalc = (d: AsterDataPoint) => {
                let height: number = this.viewportRadius * (d && !isNaN(d.sliceHeight) ? d.sliceHeight : 1) / this.maxHeight + this.innerRadius;
                return Math.max(height, this.innerRadius);
            };

            let labelArc = arc<AsterArcDescriptor>()
                .innerRadius(d => labelRadCalc(d.data))
                .outerRadius(d => labelRadCalc(d.data));

            let lineRadCalc = (d: AsterDataPoint) => {
                let height: number = (this.viewportRadius - this.innerRadius) * (d && !isNaN(d.sliceHeight) ? d.sliceHeight : 1) / this.maxHeight;
                height = this.innerRadius + height * DataRenderService.AsterRadiusRatio;
                return Math.max(height, this.innerRadius);
            };
            let outlineArc = arc<AsterArcDescriptor>()
                .innerRadius(d => lineRadCalc(d.data))
                .outerRadius(d => lineRadCalc(d.data));

            let labelLayout: ILabelLayout = this.getLabelLayout(labelArc, this.layout.viewport);
            this.drawLabels(
                dataPoints.filter(x => !isHighlight || x.data.sliceHeight !== null),
                labelsElement,
                labelLayout,
                this.layout.viewport,
                outlineArc,
                labelArc);
        }
    }

    public cleanLabels(labelsElement: Selection<any>): void {
        dataLabelUtils.cleanDataLabels(labelsElement, true);
    }

    private drawLabels(data: ArcDescriptor<AsterDataPoint>[],
        context: Selection<AsterArcDescriptor>,
        layout: ILabelLayout,
        viewport: IViewport,
        outlineArc: any,
        labelArc: any): void {
        // Hide and reposition labels that overlap
        let dataLabelManager: DataLabelManager = new DataLabelManager();
        let filteredData: any = dataLabelManager.hideCollidedLabels(viewport, data, layout, true /* addTransform */);

        if (filteredData.length === 0) {
            dataLabelUtils.cleanDataLabels(context, true);
            return;
        }

        // Draw labels
        if (context.select(DataRenderService.labelGraphicsContextClass.selectorName).empty()) {
            context.append("g").classed(DataRenderService.labelGraphicsContextClass.className, true);
        }

        let labels: Selection<any> = context
            .select(DataRenderService.labelGraphicsContextClass.selectorName)
            .selectAll(".data-labels")
            .data<LabelEnabledDataPoint>(
                filteredData,
                (d: AsterArcDescriptor) => (<ISelectionId>d.data.identity).getKey());

        labels
            .exit()
            .remove();

        labels = labels.merge(
            labels
                .enter()
                .append("text")
                .classed("data-labels", true));

        if (!labels) {
            return;
        }

        labels
            .attrs({ x: (d: LabelEnabledDataPoint) => d.labelX, y: (d: LabelEnabledDataPoint) => d.labelY, dy: ".35em" })
            .text((d: LabelEnabledDataPoint) => d.labeltext)
            .styles(layout.style);

        // Draw lines
        if (context.select(DataRenderService.linesGraphicsContextClass.selectorName).empty())
            context.append("g").classed(DataRenderService.linesGraphicsContextClass.className, true);

        // Remove lines for null and zero values
        filteredData = filter(filteredData, (d: AsterArcDescriptor) => d.data.sliceHeight !== null && d.data.sliceHeight !== 0);

        let lines = context
            .select(DataRenderService.linesGraphicsContextClass.selectorName)
            .selectAll("polyline")
            .data<LabelEnabledDataPoint>(
                filteredData,
                (d: AsterArcDescriptor) => (<ISelectionId>d.data.identity).getKey());

        let midAngle = (d: any) => { return d.startAngle + (d.endAngle - d.startAngle) / 2; };

        lines
            .exit()
            .remove();

        lines = lines.merge(
            lines.enter()
                .append("polyline")
                .classed("line-label", true));

        lines
            .attr("points", (d) => {
                let textPoint = [d.labelX, d.labelY];
                textPoint[0] = textPoint[0] + ((midAngle(<any>d) < Math.PI ? -1 : 1) * DataRenderService.LabelLinePadding);
                let chartPoint = outlineArc.centroid(<any>d);
                chartPoint[0] *= DataRenderService.ChartLinePadding;
                chartPoint[1] *= DataRenderService.ChartLinePadding;

                return <any>[chartPoint, textPoint];
            })
            .style("opacity", 0.5)
            .style("fill-opacity", 0)
            .style("stroke", () => this.settings.labels.color);


    }

    private getLabelLayout(arc: any, viewport: IViewport): ILabelLayout {
        let midAngle = (d: any) => { return d.startAngle + (d.endAngle - d.startAngle) / 2; };
        let textProperties: TextProperties = {
            fontFamily: dataLabelUtils.StandardFontFamily,
            fontSize: PixelConverter.fromPoint(this.settings.labels.fontSize),
            text: "",
        };

        let isLabelsHasConflict = (d: AsterArcDescriptor) => {
            let pos = arc.centroid(d);
            textProperties.text = d.data.label;
            let textWidth = textMeasurementService.measureSvgTextWidth(textProperties);
            let horizontalSpaceAvaliableForLabels = viewport.width / 2 - Math.abs(pos[0]);
            let textHeight = textMeasurementService.estimateSvgTextHeight(textProperties);
            let verticalSpaceAvaliableForLabels = viewport.height / 2 - Math.abs(pos[1]);
            d.isLabelHasConflict = textWidth > horizontalSpaceAvaliableForLabels || textHeight > verticalSpaceAvaliableForLabels;
            return d.isLabelHasConflict;
        };

        return {
            labelText: (d: AsterArcDescriptor) => {
                textProperties.text = d.data.label;
                let pos = arc.centroid(d);
                let xPos = isLabelsHasConflict(d) ? pos[0] * DataRenderService.AsterConflictRatio : pos[0];
                let spaceAvaliableForLabels = viewport.width / 2 - Math.abs(xPos);
                return textMeasurementService.getTailoredTextOrDefault(textProperties, spaceAvaliableForLabels);
            },
            labelLayout: {
                x: (d: AsterArcDescriptor) => {
                    let pos = arc.centroid(d);
                    textProperties.text = d.data.label;
                    return d.isLabelHasConflict ? pos[0] * DataRenderService.AsterConflictRatio : pos[0];
                },
                y: (d: AsterArcDescriptor) => {
                    let pos: [number, number] = arc.centroid(d);
                    return d.isLabelHasConflict ? pos[1] * DataRenderService.AsterConflictRatio : pos[1];
                },
            },
            filter: (d: AsterArcDescriptor) => (d != null && !isEmpty(d.data.label + "")),
            style: {
                "fill": this.settings.labels.color,
                "font-size": textProperties.fontSize,
                "text-anchor": (d: AsterArcDescriptor) => midAngle(d) < Math.PI ? "start" : "end",
            }
        };
    }
}
