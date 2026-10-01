export type Tecnologia = { area: string; itens: string[] }

export const TECNOLOGIAS: Tecnologia[] = [
  {
    area: "BACK-END",
    itens: ["Node.js", "NestJS", "TypeScript", "APIs REST", "Microsserviços", "Arquitetura de eventos", "Swagger", ".NET e C#", "Python"],
  },
  {
    area: "FRONT-END",
    itens: ["React", "Next.js", "Hooks e Context", "Vite", "Webpack", "Tailwind", "HTML e CSS"],
  },
  {
    area: "MENSAGERIA",
    itens: ["Kafka", "RabbitMQ", "Pub/Sub", "Dead-letter queue", "Consumidor idempotente"],
  },
  {
    area: "NUVEM E DEVOPS",
    itens: ["GCP Cloud Run", "Cloud Functions", "Docker", "Kubernetes", "CI/CD no GitLab", "AWS Lambda e S3"],
  },
  {
    area: "BANCOS",
    itens: ["PostgreSQL", "MySQL", "SQL Server", "Redis"],
  },
  {
    area: "QUALIDADE",
    itens: ["Jest", "Testing Library", "Testes de integração", "SOLID", "Clean Architecture", "Code review"],
  },
]

export type Experiencia = {
  /** Até 17 caracteres. */
  nome: string
  cargo: string
  periodo: string
  texto: string
}

export const EXPERIENCIAS: Experiencia[] = [
  {
    nome: "SELLIT",
    cargo: "Dev Full Stack",
    periodo: "jun 2024 a jun 2026",
    texto:
      "Microsserviços em NestJS numa plataforma de social commerce com mais de 400 lojistas e 2,5 milhões de requisições por dia. Front em React e Next.js com cobertura de testes acima de 80%. Kafka e RabbitMQ com dead-letter queue derrubaram as falhas de processamento em 35%. O deploy caiu de 40 para 8 minutos com CI/CD no GitLab rodando no GCP.",
  },
  {
    nome: "ECORECITEC",
    cargo: "Dev Full Stack",
    periodo: "mai 2024 a jun 2025",
    texto:
      "React no front, NestJS no back e testes com Jest. Cuidei da modelagem de dados e do ambiente de desenvolvimento em Docker.",
  },
  {
    nome: "BLOCKCHAIN ESCOLA",
    cargo: "Dev Full Stack",
    periodo: "set 2024 a mai 2025",
    texto:
      "Serviços distribuídos conversando por RabbitMQ e Pub/Sub, com as APIs documentadas no Swagger.",
  },
  {
    nome: "CNPQ",
    cargo: "Iniciação científica",
    periodo: "mar 2025 a jun 2025",
    texto:
      "Processei mais de 12 milhões de registros em Node.js usando Pub/Sub e Cloud Functions no GCP.",
  },
  {
    nome: "GAMBÁ",
    cargo: "Dev de Software",
    periodo: "ago 2023 a set 2024",
    texto:
      "APIs em Node.js, funções serverless na AWS e no GCP com dados em MySQL, e automações em Python e RPA.",
  },
  {
    nome: "UFRB",
    cargo: "Eng. da Computação",
    periodo: "2022 a 2025",
    texto:
      "Bacharelado na Universidade Federal do Recôncavo da Bahia. Em 2025 tirei a certificação Google Cloud Associate Cloud Engineer.",
  },
]
