import * as classNames from 'classnames';
import * as React from 'react';
import * as _ from 'lodash-es';
import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLine,
  ChartThemeColor,
  ChartThemeVariant,
  ChartTooltip,
  ChartVoronoiContainer,
  getCustomTheme,
} from '@patternfly/react-charts';
import {
  Alert,
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateIcon,
  EmptyStateVariant,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { ChartLineIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';

import * as UIActions from '../../actions/ui';
import { RootState } from '../../redux';
import { Dropdown, humanizeNumberSI, LoadingInline, usePoll, useRefWidth, useSafeFetch } from '../utils';
import { formatPrometheusDuration, parsePrometheusDuration, twentyFourHourTime } from '../utils/datetime';
import { withFallback } from '../utils/error-boundary';
import { PrometheusResponse } from '../graphs';
import { GraphEmpty } from '../graphs/graph-empty';
import { getPrometheusURL, PrometheusEndpoint } from '../graphs/helpers';
import { queryBrowserTheme } from '../graphs/themes';

const spans = ['5m', '15m', '30m', '1h', '2h', '6h', '12h', '1d', '2d', '1w', '2w'];
const dropdownItems = _.zipObject(spans, spans);
const chartTheme = getCustomTheme(ChartThemeColor.multi, ChartThemeVariant.light, queryBrowserTheme);
export const colors = chartTheme.line.colorScale;

// Use exponential notation for small or very large numbers to avoid labels with too many characters
const formatValue = v => v === 0 || (0.001 <= v && v < 1e23) ? humanizeNumberSI(v).string : v.toExponential(1);

export const Error = ({error, title = 'An error occurred'}) =>
  <Alert isInline className="co-alert" title={title} variant="danger">
    {_.get(error, 'json.error', error.message)}
  </Alert>;

const GraphEmptyState = ({children, title}) => <div className="query-browser__wrapper graph-empty-state">
  <EmptyState variant={EmptyStateVariant.full}>
    <EmptyStateIcon size="sm" icon={ChartLineIcon} />
    <Title size="sm">{title}</Title>
    <EmptyStateBody>{children}</EmptyStateBody>
  </EmptyState>
</div>;

const SpanControls: React.FC<SpanControlsProps> = React.memo(({defaultSpanText, onChange, span}) => {
  const [isValid, setIsValid] = React.useState(true);
  const [text, setText] = React.useState(formatPrometheusDuration(span));

  React.useEffect(() => {
    setText(formatPrometheusDuration(span));
  }, [span]);

  const debouncedOnChange = React.useCallback(_.debounce(onChange, 400), [onChange]);

  const setSpan = (newText: string, isDebounced = false) => {
    const newSpan = parsePrometheusDuration(newText);
    const newIsValid = (newSpan > 0);
    setIsValid(newIsValid);
    setText(newText);
    if (newIsValid && newSpan !== span) {
      const fn = isDebounced ? debouncedOnChange : onChange;
      fn(newSpan);
    }
  };

  return <React.Fragment>
    <TextInput
      aria-label="graph timespan"
      className="query-browser__span-text"
      isValid={isValid}
      onChange={v => setSpan(v, true)}
      type="text"
      value={text}
    />
    <Dropdown
      buttonClassName="query-browser__span-dropdown-button"
      items={dropdownItems}
      menuClassName="query-browser__span-dropdown-menu"
      noSelection={true}
      onChange={v => setSpan(v)}
      title="&nbsp;"
    />
    <Button
      className="query-browser__inline-control"
      onClick={() => setSpan(defaultSpanText)}
      type="button"
      variant="tertiary"
    >Reset Zoom</Button>
  </React.Fragment>;
});

const tooltipStateToProps = ({UI}: RootState, {seriesIndex}) => {
  let remaining = seriesIndex;
  let props = {};
  UI.getIn(['queryBrowser', 'queries']).filter(q => q.get('isEnabled') && q.get('query')).forEach(q => {
    const series = q.get('series') || [];
    if (series.length > remaining) {
      props = {labels: series[remaining], query: q.get('query')};
      return false;
    }
    remaining -= series.length;
  });
  return props;
};

const TooltipInner_: React.FC<TooltipInnerProps> = ({datum, labels, query, seriesIndex, x, y}) => {
  if (!query && !labels) {
    return null;
  }

  const width = 240;

  // This is actually the max tooltip height
  const height = 500;

  return <foreignObject height={height} width={width} x={x - width/2} y={y}>
    <div className="query-browser__tooltip-wrap">
      <div className="query-browser__tooltip-arrow"></div>
      <div className="query-browser__tooltip">
        <div className="query-browser__tooltip-group">
          <div className="query-browser__series-btn" style={{backgroundColor: colors[seriesIndex % colors.length]}}></div>
          {datum.x && <div className="query-browser__tooltip-time">{twentyFourHourTime(datum.x)}</div>}
        </div>
        <div className="query-browser__tooltip-group">
          <div className="co-nowrap co-truncate">{query}</div>
          <div className="query-browser__tooltip-value">{formatValue(datum.y)}</div>
        </div>
        {_.map(labels, (v, k) => <div className="co-nowrap co-truncate" key={k}>
          <span className="query-browser__tooltip-label-key">{k === '__name__' ? 'name' : k}</span> {v}
        </div>)}
      </div>
    </div>
  </foreignObject>;
};
const TooltipInner = connect(tooltipStateToProps)(TooltipInner_);

const Tooltip: React.FC<TooltipProps> = ({datum, x, y}) => datum && _.isFinite(x) && _.isFinite(y)
  ? <TooltipInner datum={datum} seriesIndex={datum._stack - 1} x={x} y={y} />
  : null;

const graphLabelComponent = <ChartTooltip flyoutComponent={<Tooltip />} />;

// Set activateData to false to work around VictoryVoronoiContainer crash (see
// https://github.com/FormidableLabs/victory/issues/1314)
// Use style because ChartVoronoiContainer does not accept a className prop
const graphContainer: any = <ChartVoronoiContainer
  activateData={false}
  labelComponent={graphLabelComponent}
  labels={() => ''}
  style={{zIndex: 1}}
/>;

const Graph: React.FC<GraphProps> = React.memo(({data, disableTooltips, span, xDomain}) => {
  const [containerRef, width] = useRefWidth();

  // Set a reasonable Y-axis range based on the min and max values in the data
  const findMin = series => _.minBy(series, 'y');
  const findMax = series => _.maxBy(series, 'y');
  let minY = _.get(findMin(_.map(data, findMin)), 'y', 0);
  let maxY = _.get(findMax(_.map(data, findMax)), 'y', 0);
  if (minY === 0 && maxY === 0) {
    minY = -1;
    maxY = 1;
  } else if (minY > 0 && maxY > 0) {
    minY = 0;
  } else if (minY < 0 && maxY < 0) {
    maxY = 0;
  }

  const tickFormat = Math.abs(maxY - minY) < 0.005
    ? v => (v === 0 ? '0' : v.toExponential(1))
    : formatValue;

  return <div ref={containerRef} style={{width: '100%'}}>
    {width > 0 && <Chart
      containerComponent={disableTooltips ? undefined : graphContainer}
      domain={{x: xDomain || [Date.now() - span, Date.now()], y: [minY, maxY]}}
      domainPadding={{y: 1}}
      height={200}
      scale={{x: 'time', y: 'linear'}}
      theme={chartTheme}
      width={width}
    >
      <ChartAxis tickCount={5} tickFormat={twentyFourHourTime} />
      <ChartAxis crossAxis={false} dependentAxis tickCount={6} tickFormat={tickFormat} />
      <ChartGroup>
        {_.map(data, (values, i) => <ChartLine key={i} data={values} />)}
      </ChartGroup>
    </Chart>}
  </div>;
});

const formatSeriesValues = (values: PrometheusValue[], samples: number, span: number): GraphDataPoint[] => {
  const newValues = _.map(values, v => {
    const y = Number(v[1]);
    return ({
      x: new Date(v[0] * 1000),
      y: Number.isNaN(y) ? null : y,
    });
  });

  // The data may have missing values, so we fill those gaps with nulls so that the graph correctly shows the
  // missing values as gaps in the line
  const start = Number(_.get(newValues, '[0].x'));
  const end = Number(_.get(_.last(newValues), 'x'));
  const step = span / samples;
  _.range(start, end, step).map((t, i) => {
    const x = new Date(t);
    if (_.get(newValues, [i, 'x']) > x) {
      newValues.splice(i, 0, {x, y: null});
    }
  });

  return newValues;
};

// Try to limit the graph to this number of data points
const maxDataPointsSoft = 6000;

// If we have more than this number of data points, do not render the graph
const maxDataPointsHard = 10000;

// Min and max number of data samples per data series
const minSamples = 20;
const maxSamples = 300;

// We don't want to refresh all the graph data for just a small adjustment in the number of samples, so don't update
// unless the number of samples would change by at least this proportion
const samplesLeeway = 0.2;

const QueryBrowser_: React.FC<QueryBrowserProps> = ({
  defaultTimespan,
  disabledSeries = [],
  filterLabels,
  GraphLink,
  hideGraphs,
  patchQuery,
  queries,
}) => {
  // For the default time span, use the first of the suggested span options that is at least as long as defaultTimespan
  const defaultSpanText = spans.find(s => parsePrometheusDuration(s) >= defaultTimespan);

  const [xDomain, setXDomain] = React.useState();
  const [error, setError] = React.useState();
  const [isDatasetTooBig, setIsDatasetTooBig] = React.useState(false);
  const [isZooming, setIsZooming] = React.useState(false);
  const [results, setResults] = React.useState();
  const [samples, setSamples] = React.useState(maxSamples);
  const [span, setSpan] = React.useState(parsePrometheusDuration(defaultSpanText));
  const [updating, setUpdating] = React.useState(true);
  const [x1, setX1] = React.useState(0);
  const [x2, setX2] = React.useState(0);

  const endTime = _.get(xDomain, '[1]');

  const safeFetch = useSafeFetch();

  const safeFetchQuery = (query: string) => {
    if (_.isEmpty(query)) {
      return Promise.resolve();
    }
    const url = getPrometheusURL({
      endpoint: PrometheusEndpoint.QUERY_RANGE,
      endTime,
      query,
      samples,
      timeout: '5s',
      timespan: span,
    });
    return safeFetch(url);
  };

  const tick = () => Promise.all(_.map(queries, safeFetchQuery))
    .then((responses: PrometheusResponse[]) => {
      const newResults = _.map(responses, 'data.result');
      const numDataPoints = _.sumBy(newResults, r => _.sumBy(r, 'values.length'));

      if (numDataPoints > maxDataPointsHard && samples === minSamples) {
        setIsDatasetTooBig(true);
        return;
      }
      setIsDatasetTooBig(false);

      const newSamples = _.clamp(Math.floor(samples * maxDataPointsSoft / numDataPoints), minSamples, maxSamples);

      // Change `samples` if either
      //   - It will change by a proportion greater than `samplesLeeway`
      //   - It will change to the upper or lower limit of its allowed range
      if ((Math.abs(newSamples - samples) / samples > samplesLeeway) ||
        (newSamples !== samples && (newSamples === maxSamples || newSamples === minSamples))) {
        setSamples(newSamples);
      } else {
        setResults(newResults);
        _.each(newResults, (r, i) => patchQuery(i, {
          query: queries[i],
          series: r ? _.map(r, 'metric') : undefined,
        }));
        setUpdating(false);
      }
      setError(undefined);
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        setError(err);
        setUpdating(false);
      }
    });

  // If an end time was set, stop polling since we are no longer displaying the latest data. Otherwise use a polling
  // interval relative to the graph's timespan, but not less than 5s.
  const delay = endTime ? null : Math.max(span / 120, 5000);

  usePoll(tick, delay, endTime, queries, samples, span);

  React.useEffect(() => setUpdating(true), [endTime, queries, samples, span]);

  const graphData: GraphDataPoint[][] = React.useMemo(() => _.flatten(
    _.map(results, (result, responseIndex) => {
      return _.map(result, ({metric, values}) => {
        // If filterLabels is specified, ignore all series that don't match
        const isIgnored = filterLabels
          // Ignore internal labels (start with "__")
          ? _.some(metric, (v, k) => filterLabels[k] !== v && !_.startsWith(k, '__'))
          : _.some(disabledSeries[responseIndex], s => _.isEqual(s, metric));

        return isIgnored ? [{x: null, y: null}] : formatSeriesValues(values, samples, span);
      });
    })
  // Some of the hook dependencies are not included because we instead want those dependencies to trigger an Prometheus
  // API call, which will update `results` and then trigger this hook
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [disabledSeries, filterLabels, results]);

  const onSpanChange = React.useCallback((newSpan: number) => {
    setXDomain(undefined);
    setSpan(newSpan);
  }, []);

  const isRangeVector = _.get(error, 'json.error', '').match(/invalid expression type "range vector"/);

  if (hideGraphs) {
    return (error && !isRangeVector) ? <Error error={error} /> : null;
  }

  if (isRangeVector) {
    return <GraphEmptyState title="Ungraphable results">
      Query results include range vectors, which cannot be graphed. Try adding a function to transform the data.
    </GraphEmptyState>;
  }

  if (isDatasetTooBig) {
    return <GraphEmptyState title="Ungraphable results">
      The resulting dataset is too large to graph.
    </GraphEmptyState>;
  }

  const onMouseDown = (e) => {
    if (!isZooming) {
      setIsZooming(true);
      const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
      setX1(x);
      setX2(x);
    }
  };

  const onMouseMove = (e) => {
    if (isZooming) {
      setX2(e.clientX - e.currentTarget.getBoundingClientRect().left);
    }
  };

  const onMouseUp = (e) => {
    if (isZooming) {
      setIsZooming(false);

      const xMin = Math.min(x1, x2);
      const xMax = Math.max(x1, x2);

      // Don't do anything if a range was not selected (don't zoom if you just click the graph)
      if (xMax === xMin) {
        return;
      }

      const {width} = e.currentTarget.getBoundingClientRect();
      const oldFrom = _.get(xDomain, '[0]', Date.now() - span);
      let from = oldFrom + (span * xMin / width);
      let to = oldFrom + (span * xMax / width);
      let newSpan = to - from;

      // Don't allow zooming to less than 10 seconds
      const minSpan = 10 * 1000;
      if (newSpan < minSpan) {
        newSpan = minSpan;
        const middle = (from + to) / 2;
        from = middle - (newSpan / 2);
        to = middle + (newSpan / 2);
      }

      setXDomain([from, to]);
      setSpan(newSpan);
    }
  };

  return <div className={classNames('query-browser__wrapper', {'graph-empty-state': _.isEmpty(graphData)})}>
    <div className="query-browser__controls">
      <div className="query-browser__controls--left">
        <SpanControls defaultSpanText={defaultSpanText} onChange={onSpanChange} span={span} />
        {updating && <div className="query-browser__loading">
          <LoadingInline />
        </div>}
      </div>
      {GraphLink && <div className="query-browser__controls--right">
        <GraphLink />
      </div>}
    </div>
    {error && <Error error={error} />}
    {(_.isEmpty(graphData) && !updating) && <GraphEmpty />}
    {!_.isEmpty(graphData) && <React.Fragment>
      {samples < maxSamples && <Alert
        isInline
        className="co-alert"
        title="Displaying with reduced resolution due to large dataset."
        variant="info"
      />}
      <div className="graph-wrapper graph-wrapper--query-browser">
        <div className="query-browser__zoom" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
          {isZooming && <div className="query-browser__zoom-overlay" style={{left: Math.min(x1, x2), width: Math.abs(x1 - x2)}}></div>}
          <Graph data={graphData} disableTooltips={isZooming} xDomain={xDomain} span={span} />
        </div>
      </div>
    </React.Fragment>}
  </div>;
};
export const QueryBrowser = withFallback(connect(
  ({UI}: RootState) => ({hideGraphs: !!UI.getIn(['monitoring', 'hideGraphs'])}),
  {patchQuery: UIActions.queryBrowserPatchQuery}
)(QueryBrowser_));

type AxisDomain = [number, number];

type GraphDataPoint = {
  x: Date;
  y: number;
};

export type Labels = {[key: string]: string};

export type QueryObj = {
  disabledSeries?: Labels[];
  isEnabled?: boolean;
  isExpanded?: boolean;
  query?: string;
  series?: Labels[];
  text?: string;
}

type PrometheusValue = [number, string];

type GraphProps = {
  data: GraphDataPoint[][];
  disableTooltips: boolean;
  span: number;
  xDomain: AxisDomain;
};

type QueryBrowserProps = {
  defaultTimespan: number;
  disabledSeries?: Labels[][];
  filterLabels?: Labels;
  GraphLink?: React.ComponentType<{}>;
  hideGraphs: boolean;
  patchQuery: (index: number, patch: QueryObj) => any;
  queries: string[];
};

type SpanControlsProps = {
  defaultSpanText: string;
  onChange: (span: number) => void;
  span: number;
};

type TooltipDatum = {_stack: number, x: Date, y: number};

type TooltipInnerProps = {
  datum: TooltipDatum;
  labels?: Labels;
  query?: string;
  seriesIndex: number;
  x: number;
  y: number;
};

type TooltipProps = {
  datum?: TooltipDatum;
  x?: number;
  y?: number;
};
