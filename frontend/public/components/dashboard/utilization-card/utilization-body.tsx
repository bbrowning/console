import * as React from 'react';
import { Row, Col } from 'patternfly-react';
import { ChartAxis } from '@patternfly/react-charts';
import { global_breakpoint_sm as breakpointSM } from '@patternfly/react-tokens';

import { useRefWidth } from '../../utils';

const formatDate = (date: Date): string => {
  const minutes = `0${date.getMinutes()}`.slice(-2);
  return `${date.getHours()}:${minutes}`;
};

const UtilizationAxis: React.FC<UtilizationAxisProps> = ({ timestamps }) => {
  const [containerRef, width] = useRefWidth();
  return (
    <div ref={containerRef}>
      <ChartAxis
        scale={{ x: 'time' }}
        tickValues={timestamps}
        tickFormat={formatDate}
        orientation="top"
        height={15}
        width={width}
        padding={{ top: 30, bottom: 0, left: 70, right: 0 }}
        style={{
          axis: {visibility: 'hidden'},
        }}
        fixLabelOverlap
      />
    </div>
  );
};

export const UtilizationBody: React.FC<UtilizationBodyProps> = ({ timestamps, children }) => {
  const [containerRef, width] = useRefWidth();

  const axis = width < parseInt(breakpointSM.value, 10) ?
    timestamps.length === 0 ? null : (
      <Row className="co-utilization-card__item">
        <Col className="co-utilization-card__axis">
          <UtilizationAxis timestamps={timestamps} />
        </Col>
      </Row>
    ) : (
      <Row className="co-utilization-card__item">
        <Col lg={5} md={5} sm={5} xs={5} />
        <Col lg={7} md={7} sm={7} xs={7} className="co-utilization-card__axis">
          {timestamps.length > 0 && <UtilizationAxis timestamps={timestamps} />}
        </Col>
      </Row>
    );
  return (
    <div
      className="co-dashboard-card__body--top-margin co-dashboard-card__body--no-padding co-utilization-card__body"
      ref={containerRef}
    >
      {axis}
      <div>{children}</div>
    </div>
  );
};

type UtilizationBodyProps = {
  children: React.ReactNode;
  timestamps: Date[];
};

type UtilizationAxisProps = {
  timestamps: Date[];
}
