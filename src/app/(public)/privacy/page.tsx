import PublicPolicyPage, { policyMetadata } from '@/components/PublicPolicyPage'

export const generateMetadata = () => policyMetadata('privacy')

export default function Page() {
  return <PublicPolicyPage slug="privacy" />
}
