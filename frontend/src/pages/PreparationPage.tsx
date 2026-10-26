import { EmptyState } from '../components/EmptyState'
import { PageHeading } from '../components/PageHeading'
import { SurfaceCard } from '../components/SurfaceCard'
import type { IconName } from '../components/Icon'

export function PreparationPage({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: IconName
}) {
  return (
    <>
      <PageHeading eyebrow="Plataforma analítica · estrutura inicial" title={title} description={description} />
      <SurfaceCard>
        <EmptyState
          icon={icon}
          title="Página em preparação"
          description="A navegação está disponível. Os dados e as ações desta página serão integrados em uma próxima entrega."
        />
      </SurfaceCard>
    </>
  )
}
