import React from 'react';
import { createDevTools } from 'redux-devtools';
import LogMonitor from 'redux-devtools-log-monitor';
import DockMonitor from 'redux-devtools-dock-monitor';
import DiffMonitor from 'redux-devtools-diff-monitor';
import ChartMonitor from 'redux-devtools-chart-monitor';

export default createDevTools(
  <DockMonitor toggleVisibilityKey="ctrl-h" changePositionKey="ctrl-q" changeMonitorKey="ctrl-m"
               defaultPosition="bottom" defaultIsVisible={ false }>
    <ChartMonitor />
    <DiffMonitor />
    <LogMonitor />
  </DockMonitor>
);
