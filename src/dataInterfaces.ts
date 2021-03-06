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


import * as d3 from "d3";
import { Arc } from "d3-shape";
// d3
export type ArcDescriptor<T> = Arc<any, T>;

// powerbi
// tslint:disable-next-line
import powerbi from "powerbi-visuals-api";
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

export type Selection<T> = d3.Selection<any, T, any, any>;
export type UpdateSelection<T> = d3.Selection<any, T, any, any>;

// powerbi.extensibility.utils.chart
import * as LegendUtil from "powerbi-visuals-utils-chartutils";
import LegendData = LegendUtil.legendInterfaces.LegendData;

// powerbi.extensibility.utils.formatting
import {valueFormatter} from "powerbi-visuals-utils-formattingutils";
import IValueFormatter = valueFormatter.IValueFormatter;

// powerbi.extensibility.utils.interactivity
import { interactivitySelectionService} from "powerbi-visuals-utils-interactivityutils";
import SelectableDataPoint = interactivitySelectionService.SelectableDataPoint;

import { AsterPlotSettings } from "./settings";

import {} from "powerbi-visuals-utils-tooltiputils";

export interface AsterPlotData {
    dataPoints: AsterDataPoint[];
    highlightedDataPoints?: AsterDataPoint[];
    settings: AsterPlotSettings;
    hasHighlights: boolean;
    legendData: LegendData;
    labelFormatter: IValueFormatter;
    centerText: string;
}

export interface AsterArcDescriptor extends ArcDescriptor<AsterDataPoint> {
    isLabelHasConflict?: boolean;
    data: AsterDataPoint;
}

export interface AsterDataPoint extends SelectableDataPoint {
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    sliceHeight?: number;
    sliceWidth?: number;
    label: string;
    highlight?: boolean;
    tooltipInfo: VisualTooltipDataItem[];
    labelFontSize: string;
    categoryName: string;
}
