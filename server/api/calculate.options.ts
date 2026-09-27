import { calculationHeaders } from './calculate.query';

export default () =>
  new Response(null, { status: 204, headers: calculationHeaders });
