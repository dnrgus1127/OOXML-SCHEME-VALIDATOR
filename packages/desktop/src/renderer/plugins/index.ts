import { registerPlugin } from './registry'
import { odfChartStyleResolver } from './built-in/odf-chart-style-resolver'

registerPlugin(odfChartStyleResolver)

export { registerPlugin, getAllPlugins, getActivePlugins } from './registry'
export type {
  OoxmlPlugin,
  OoxmlPluginHooks,
  PluginContext,
  PluginPreview,
  PluginPreviewSample,
  MonacoHoverContribution,
  MonacoHoverHookParams,
} from './types'
