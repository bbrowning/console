import * as React from 'react';
import { connect } from 'react-redux';
import { NavItemSeparator } from '@patternfly/react-core';

import { featureReducerName } from '../../reducers/features';
import { FLAGS } from '../../const';
import { monitoringReducerName, MonitoringRoutes } from '../../reducers/monitoring';

import {
  BuildConfigModel,
  BuildModel,
  ChargebackReportModel,
  ClusterServiceVersionModel,
  DeploymentConfigModel,
  ImageStreamModel,
  MachineAutoscalerModel,
  MachineConfigModel,
  MachineConfigPoolModel,
  MachineModel,
  MachineSetModel,
} from '../../models';

import { referenceForModel } from '../../module/k8s';
import { ExternalLink, HrefLink, ResourceNSLink, ResourceClusterLink } from './items';
import { NavSection } from './section';
import { formatNamespacedRouteForResource } from '../../actions/ui';

type SeparatorProps = {
  required?: string;
}
// Wrap `NavItemSeparator` so we can use `required` without prop type errors.
const Separator: React.FC<SeparatorProps> = () => <NavItemSeparator />;

const searchStartsWith = ['search'];
const provisionedServicesStartsWith = ['serviceinstances', 'servicebindings'];
const brokerManagementStartsWith = ['clusterservicebrokers', 'clusterserviceclasses'];
const rolesStartsWith = ['roles', 'clusterroles'];
const rolebindingsStartsWith = ['rolebindings', 'clusterrolebindings'];
const quotaStartsWith = ['resourcequotas', 'clusterresourcequotas'];
const imagestreamsStartsWith = ['imagestreams', 'imagestreamtags'];
const monitoringAlertsStartsWith = ['monitoring/alerts', 'monitoring/alertrules', 'monitoring/silences', 'monitoring/alertmanageryaml'];
const clusterSettingsStartsWith = ['settings/cluster', 'settings/idp', 'config.openshift.io'];
const meteringStartsWith = ['metering.openshift.io'];
const apiExplorerStartsWith = ['api-explorer', 'api-resource'];

const monitoringNavSectionStateToProps = (state) => ({
  canAccess: !!state[featureReducerName].get(FLAGS.CAN_GET_NS),
  grafanaURL: state[monitoringReducerName].get(MonitoringRoutes.Grafana),
  kibanaURL: state[monitoringReducerName].get(MonitoringRoutes.Kibana),
});

const MonitoringNavSection_ = ({grafanaURL, canAccess, kibanaURL}) => {
  const showAlerts = canAccess && !!window.SERVER_FLAGS.prometheusBaseURL;
  const showSilences = canAccess && !!window.SERVER_FLAGS.alertManagerBaseURL;
  const showGrafana = canAccess && !!grafanaURL;
  return showAlerts || showSilences || showGrafana || kibanaURL
    ? <NavSection title="Monitoring">
      {showAlerts && <HrefLink href="/monitoring/alerts" name="Alerting" startsWith={monitoringAlertsStartsWith} />}
      {showAlerts && <HrefLink href="/monitoring/query-browser" name="Metrics" />}
      {showGrafana && <ExternalLink href={grafanaURL} name="Dashboards" />}
      {kibanaURL && <ExternalLink href={kibanaURL} name="Logging" />}
    </NavSection>
    : null;
};
const MonitoringNavSection = connect(monitoringNavSectionStateToProps)(MonitoringNavSection_);

const AdminNav = () => (
  <React.Fragment>
    <NavSection title="Home">
      <HrefLink href="/dashboards" activePath="/dashboards/" name="Dashboards" required={FLAGS.CAN_LIST_NS} />
      <ResourceClusterLink resource="projects" name="Projects" required={FLAGS.OPENSHIFT} />
      <HrefLink href="/search" name="Search" startsWith={searchStartsWith} />
      <HrefLink href="/api-explorer" name="Explore" startsWith={apiExplorerStartsWith} />
      <ResourceNSLink resource="events" name="Events" />
    </NavSection>

    <NavSection title="Operators" required={FLAGS.OPERATOR_LIFECYCLE_MANAGER}>
      <HrefLink
        required={[FLAGS.CAN_LIST_PACKAGE_MANIFEST, FLAGS.CAN_LIST_OPERATOR_GROUP]}
        href="/operatorhub"
        name="OperatorHub"
        activePath="/operatorhub/"
      />
      <ResourceNSLink
        model={ClusterServiceVersionModel}
        resource={ClusterServiceVersionModel.plural}
        required={FLAGS.CAN_LIST_PACKAGE_MANIFEST}
        name="Installed Operators"
      />
    </NavSection>

    <NavSection title="Workloads">
      <ResourceNSLink resource="pods" name="Pods" />
      <ResourceNSLink resource="deployments" name="Deployments" />
      <ResourceNSLink resource="deploymentconfigs" name={DeploymentConfigModel.labelPlural} required={FLAGS.OPENSHIFT} />
      <ResourceNSLink resource="statefulsets" name="Stateful Sets" />
      <ResourceNSLink resource="secrets" name="Secrets" />
      <ResourceNSLink resource="configmaps" name="Config Maps" />
      <Separator />
      <ResourceNSLink resource="cronjobs" name="Cron Jobs" />
      <ResourceNSLink resource="jobs" name="Jobs" />
      <ResourceNSLink resource="daemonsets" name="Daemon Sets" />
      <ResourceNSLink resource="replicasets" name="Replica Sets" />
      <ResourceNSLink resource="replicationcontrollers" name="Replication Controllers" />
      <ResourceNSLink resource="horizontalpodautoscalers" name="Horizontal Pod Autoscalers" />
    </NavSection>

    { /* Temporary addition of Knative Serverless section until extensibility allows for section ordering
         and admin-nav gets contributed through extensions. */ }
    <NavSection title="Serverless" />

    <NavSection title="Networking">
      <ResourceNSLink resource="services" name="Services" />
      <ResourceNSLink resource="routes" name="Routes" required={FLAGS.OPENSHIFT} />
      <ResourceNSLink resource="ingresses" name="Ingresses" />
      <ResourceNSLink resource="networkpolicies" name="Network Policies" />
    </NavSection>

    <NavSection title="Storage">
      <ResourceClusterLink resource="persistentvolumes" name="Persistent Volumes" required={FLAGS.CAN_LIST_PV} />
      <ResourceNSLink resource="persistentvolumeclaims" name="Persistent Volume Claims" />
      <ResourceClusterLink resource="storageclasses" name="Storage Classes" />
    </NavSection>

    <NavSection title="Builds" required={FLAGS.OPENSHIFT}>
      <ResourceNSLink resource="buildconfigs" name={BuildConfigModel.labelPlural} />
      <ResourceNSLink resource="builds" name={BuildModel.labelPlural} />
      <ResourceNSLink resource="imagestreams" name={ImageStreamModel.labelPlural} startsWith={imagestreamsStartsWith} />
    </NavSection>

    <NavSection title="Service Catalog" required={FLAGS.SERVICE_CATALOG}>
      <HrefLink
        href="/provisionedservices"
        name="Provisioned Services"
        activePath="/provisionedservices/"
        startsWith={provisionedServicesStartsWith}
      />
      <HrefLink
        href="/brokermanagement"
        name="Broker Management"
        activePath="/brokermanagement/"
        startsWith={brokerManagementStartsWith}
      />
    </NavSection>

    <MonitoringNavSection />

    <NavSection title="Compute" required={FLAGS.CAN_LIST_NODE}>
      <ResourceClusterLink resource="nodes" name="Nodes" />
      <ResourceNSLink resource={referenceForModel(MachineModel)} name="Machines" required={FLAGS.CLUSTER_API} />
      <ResourceNSLink resource={referenceForModel(MachineSetModel)} name="Machine Sets" required={FLAGS.CLUSTER_API} />
      <ResourceNSLink resource={referenceForModel(MachineAutoscalerModel)} name="Machine Autoscalers" required={FLAGS.MACHINE_AUTOSCALER} />
      <Separator required={FLAGS.MACHINE_CONFIG} />
      <ResourceClusterLink resource={referenceForModel(MachineConfigModel)} name="Machine Configs" required={FLAGS.MACHINE_CONFIG} />
      <ResourceClusterLink resource={referenceForModel(MachineConfigPoolModel)} name="Machine Config Pools" required={FLAGS.MACHINE_CONFIG} />
    </NavSection>

    <NavSection title="Administration">
      <HrefLink href="/settings/cluster" activePath="/settings/cluster/" name="Cluster Settings" required={FLAGS.CLUSTER_VERSION} startsWith={clusterSettingsStartsWith} />
      <ResourceClusterLink resource="namespaces" name="Namespaces" required={FLAGS.CAN_LIST_NS} />
      <ResourceNSLink resource="serviceaccounts" name="Service Accounts" />
      <ResourceNSLink resource="roles" name="Roles" startsWith={rolesStartsWith} />
      <ResourceNSLink resource="rolebindings" name="Role Bindings" startsWith={rolebindingsStartsWith} />
      <ResourceNSLink resource="resourcequotas" name="Resource Quotas" startsWith={quotaStartsWith} />
      <ResourceNSLink resource="limitranges" name="Limit Ranges" />
      <HrefLink href={formatNamespacedRouteForResource(referenceForModel(ChargebackReportModel), 'openshift-metering')}
        name="Chargeback"
        required={[FLAGS.CHARGEBACK, FLAGS.CAN_LIST_CHARGEBACK_REPORTS]}
        startsWith={meteringStartsWith} />
      <ResourceClusterLink resource="customresourcedefinitions" name="Custom Resource Definitions" required={FLAGS.CAN_LIST_CRD} />
    </NavSection>
  </React.Fragment>
);

export default AdminNav;
