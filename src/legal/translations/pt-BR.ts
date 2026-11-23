import type { LegalTranslation } from '../documents';

/**
 * Brazilian Portuguese translation of the privacy policy and terms of both builds, machine-translated from English on
 * 20 Nov 2026 and not yet reviewed by a native speaker or a lawyer. The sections added on 21 Nov 2026 (protective
 * clauses) are machine-translated too and not reviewed. The English version prevails.
 */

const BLOCKING_HEADING = 'Bloqueio, estilos de página, scripts e apps';

const BLOCKING_PRIVACY_START =
  'O bloqueio de anúncios, rastreadores e anúncios em vídeo acontece no seu celular: as listas de filtros são ' +
  'baixadas para o celular (veja acima) e as solicitações de cada página são verificadas com elas ali mesmo, então ' +
  'nada sobre as páginas que você visita vai para os publicadores das listas';

const BLOCKING_PRIVACY_COOKIES =
  '. “Ocultar avisos de cookies” apenas oculta os avisos; ele nunca aceita nem recusa cookies por você. Suas ' +
  'próprias regras, estilos salvos e scripts salvos são armazenados somente no celular e, se você fizer um, ';

const BLOCKING_PRIVACY_AI =
  'Quando o assistente escreve um estilo ou um script, o serviço de IA recebe sua solicitação e o conteúdo da ' +
  'página de que precisa, como em qualquer pergunta, e o resultado de um script que você aprovou também vai para ' +
  'ele; o Qutai recusa scripts que mexem com cookies, e o resultado de um script nunca é guardado na memória do ' +
  'assistente, nos backups nem no histórico de ações. Os apps dentro do Qutai são armazenados somente no celular ' +
  'e, se você os incluir, ';

const BLOCKING_PRIVACY_APPS =
  'Quando você pede ao Qutai para criar ou corrigir um app, o código e as mensagens de erro dele vão para o ' +
  'serviço de IA; o que você salva em um app, nunca. Os apps não podem acessar a internet nem ver sites ou os ' +
  'cookies deles.';

const BLOCKING_PRIVACY_OPEN_SOURCE =
  BLOCKING_PRIVACY_START +
  BLOCKING_PRIVACY_COOKIES +
  'no seu arquivo de backup, criptografado com sua senha. ' +
  BLOCKING_PRIVACY_AI +
  'no seu arquivo de backup. ' +
  BLOCKING_PRIVACY_APPS;

const BLOCKING_PRIVACY_PRO =
  BLOCKING_PRIVACY_START +
  ' nem para o Qutai' +
  BLOCKING_PRIVACY_COOKIES +
  'nos seus backups (o arquivo que você exporta ou o backup na sua conta Qutai), criptografados com sua senha. ' +
  BLOCKING_PRIVACY_AI +
  'nos seus backups. ' +
  BLOCKING_PRIVACY_APPS;

/** Pro’s first terms bullet ends with this, after a semicolon. */
const NOT_A_PARTY = 'o Qutai não é parte desse acordo e não pode reembolsar esses custos.';

const BROWSER_BODY =
  'O Qutai mostra sites que outras pessoas administram. Não controlamos, verificamos nem endossamos os sites, o ' +
  'conteúdo deles ou os produtos e serviços que oferecem, e não somos responsáveis por eles. Os sites e seu ' +
  'conteúdo pertencem a seus proprietários. Os termos de cada site e a lei se aplicam quando você o usa, e você é ' +
  'responsável por cumpri-los. Links, resultados de pesquisa e sugestões, incluindo os do assistente, não são ' +
  'recomendações nossas.';

const ASSISTANT_BODY =
  'O assistente pode ler páginas, clicar, digitar, preencher formulários e preparar publicações, mensagens e ' +
  'pedidos quando você pede. Antes de publicar ou enviar texto em um site, o Qutai pede a sua aprovação. Concluir ' +
  'um pagamento fica desativado até você ativar “Deixar o assistente concluir pagamentos” em ' +
  'Configurações › Assistente; mesmo assim, cada pagamento precisa da sua aprovação na janela do próprio Qutai, que ' +
  'mostra o total. A IA pode cometer erros: confira o que você está aprovando e revise compras, reservas, ' +
  'pagamentos, publicações, mensagens, exclusões, alterações de conta e outras ações importantes antes que sejam ' +
  'concluídas. Você é responsável pelas ações que pede ou aprova, como se você mesmo as tivesse realizado. Suas ' +
  'compras e outras relações com sites, vendedores e outras pessoas são entre você e eles: o Qutai não é parte ' +
  'delas e nunca processa seus pagamentos a eles. Você pode exigir confirmação antes de cada ação em ' +
  'Configurações e bloquear o assistente nos sites que escolher.';

const AI_ANSWERS_BODY =
  'Respostas, resumos, traduções e qualquer outra coisa que a IA escreve podem estar errados, incompletos ou ' +
  'desatualizados. Eles não são aconselhamento profissional, por exemplo médico, jurídico, financeiro ou ' +
  'tributário: para esses assuntos, consulte um profissional qualificado. Confira informações importantes antes ' +
  'de confiar nelas.';

const BLOCKING_TERMS_BODY =
  'Bloquear anúncios e rastreadores, ocultar avisos de cookies e bloquear anúncios em vídeo são recursos que você ' +
  'escolhe: você pode desativar cada um em Configurações › Privacidade e segurança, e desativar o bloqueio para ' +
  'um site no painel desse site (“Bloquear anúncios em vídeos” fica desativado até você ativá-lo). O bloqueio ' +
  'funciona apenas nas páginas que você abre no seu celular; ele não altera os próprios sites. As listas de ' +
  'filtros são feitas por terceiros sob as licenças deles (por exemplo, EasyList sob GPLv3 ou CC BY-SA 3.0, e ' +
  'AdGuard sob GPLv3); seu celular as baixa dos publicadores delas, e Configurações mostra a página inicial e a ' +
  'licença de cada lista. Não garantimos o que é ou não é bloqueado: as listas podem bloquear demais ou de menos, ' +
  'e um site pode quebrar, mostrar menos ou pedir que você desative o bloqueio. Usar ou não o bloqueio em um site ' +
  'é uma decisão sua, e os termos desse site se aplicam à sua visita.';

const STYLES_BODY =
  'Você pode pedir ao assistente para mudar a aparência de uma página (um estilo) ou executar um script em uma ' +
  'página, mantê-los para um site, e você mesmo pode escrevê-los, editá-los, importá-los e exportá-los. Os ' +
  'scripts ficam desativados até você ativá-los em Configurações › Assistente. O Qutai mostra cada estilo e cada ' +
  'script que o assistente escreve e só o executa depois que você o aprovar, e os scripts importados continuam ' +
  'desativados até você aprová-los. Estilos e scripts são executados apenas nas páginas que você abre, no seu ' +
  'celular. O Qutai recusa alguns códigos arriscados, mas não revisa o código que você escreve, edita ou importa, ' +
  'e não pode garantir o que qualquer código faz: um script é executado com o seu login nesse site, pode alterar ' +
  'ou quebrar a página e pode afetar sua conta nele. Aprove apenas o que você entende e em que confia. Você é ' +
  'responsável pelos estilos e scripts que aprova, mantém, importa ou compartilha.';

const APPS_BODY =
  'Os apps dentro do Qutai são escritos pela IA a seu pedido. Eles são executados isolados da internet e dos ' +
  'sites, mas não são testados nem revisados por nós e não têm garantia: um app pode ter erros ou perder os dados ' +
  'salvos nele, então exporte ou faça backup de tudo o que for importante. Os apps que você importa de um arquivo ' +
  'podem vir de qualquer pessoa e não são revisados por nós; o Qutai mostra o que é um app importado e o que ele ' +
  'pode usar antes de você ativá-lo. Você é responsável pelos apps que ativa e pelos apps que compartilha com ' +
  'outras pessoas.';

const DOWNLOADS_BODY =
  'Você decide o que baixar, abrir e instalar. O Qutai avisa você antes de baixar arquivos que podem instalar ou ' +
  'executar código, mas não verifica os arquivos em busca de vírus ou outros danos. {{ios:O próprio Qutai nunca instala nada. Arquivos baixados podem|android:Abrir um app baixado (um arquivo APK) o entrega ao instalador do sistema; o próprio Qutai nunca instala nada. Arquivos e apps de fora do Google Play podem}} prejudicar seu celular ou seus dados; baixá-los, abri-los e ' +
  'instalá-los é responsabilidade sua, assim como ter o direito de fazer isso.';

const ACCEPTABLE_USE_BULLETS =
  '• violar a lei ou os direitos de outras pessoas, como a privacidade, os direitos autorais ou as marcas delas;\n' +
  '• violar os termos de sites ou de provedores de IA;\n' +
  '• contornar senhas, controles de acesso, paywalls, proteções contra cópia (DRM) ou outras proteções técnicas;\n' +
  '• coletar, rastrear ou publicar dados pessoais de outras pessoas de forma ilícita;\n' +
  '• enviar spam, criar contas ou avaliações falsas, publicar ou agir em massa de forma automatizada, ou ' +
  'sobrecarregar sites;\n' +
  '• enganar ou fraudar qualquer pessoa, ou espalhar malware';

const WARRANTY_BODY =
  'O Qutai é fornecido “no estado em que se encontra” e “conforme disponível”. Trabalhamos para que ele seja útil ' +
  'e seguro, mas não prometemos que ele sempre funcionará, que estará livre de erros, que bloqueará o que você ' +
  'espera ou que funcionará com todos os sites, e não damos garantias além das que a lei exige. Na medida ' +
  'permitida pela lei, não nos responsabilizamos por perdas causadas por sites e seu conteúdo, por outras ' +
  'pessoas, pelos serviços de provedores de IA, por listas de filtros, por estilos, scripts e apps que você ' +
  'aprova ou importa, ou por ações que você pediu ou aprovou, nem por perdas indiretas, como lucros cessantes. ' +
  'Nada nestes termos limita a responsabilidade por dolo ou culpa grave, por morte ou lesão corporal, ou qualquer ' +
  'outra responsabilidade que a lei não permita limitar ou excluir.';

const CONSUMER_BODY =
  'Se você usa o Qutai como consumidor, mantém todos os direitos que a lei do lugar onde você mora dá aos ' +
  'consumidores e que não podem ser renunciados por contrato, como seus direitos pela legislação turca de defesa ' +
  'do consumidor (Lei nº 6502 de Proteção do Consumidor) e pela legislação de defesa do consumidor da União ' +
  'Europeia e do Espaço Econômico Europeu. Nada nestes termos limita ou exclui esses direitos; quando um termo ' +
  'entrar em conflito com eles, esses direitos prevalecem.';

const TERMS_CHANGES =
  'Se estes termos mudarem, o Qutai mostra a nova versão e pede que você a aceite antes de continuar. Se ' +
  'esta tradução e a versão em inglês divergirem, prevalece a versão em inglês.';

/** The terms sections both builds share, from "Qutai is a browser" to "Changes", around Acceptable use. */
function sharedTerms(acceptableUse: string) {
  return [
    { heading: 'O Qutai é um navegador', body: BROWSER_BODY },
    { heading: 'O assistente age em seu nome', body: ASSISTANT_BODY },
    { heading: 'Respostas da IA', body: AI_ANSWERS_BODY },
    { heading: 'Bloqueio de anúncios e rastreadores', body: BLOCKING_TERMS_BODY },
    { heading: 'Estilos de página e scripts', body: STYLES_BODY },
    { heading: 'Apps dentro do Qutai', body: APPS_BODY },
    { heading: 'Downloads e instalação de arquivos', body: DOWNLOADS_BODY },
    { heading: 'Uso aceitável', body: acceptableUse },
    { heading: 'Ausência de garantia e limites de responsabilidade', body: WARRANTY_BODY },
    { heading: 'Seus direitos como consumidor', body: CONSUMER_BODY },
    { heading: 'Alterações', body: TERMS_CHANGES },
  ];
}

export const ptBR: LegalTranslation = {
  openSource: {
    privacy: {
      title: 'Política de Privacidade',
      intro:
        'O Qutai é um navegador web com um assistente de IA. Nós o criamos para que sua navegação fique no seu ' +
        'celular. O Qutai não tem servidores próprios: não coletamos, armazenamos nem vendemos seus dados.',
      sections: [
        {
          heading: 'O que fica no seu celular',
          body:
            'Suas guias, histórico, favoritos, páginas salvas, downloads, permissões de sites, a memória do ' +
            'assistente (incluindo suas respostas às perguntas opcionais da configuração inicial e o formulário de ' +
            'endereço), suas instruções personalizadas, o histórico de ações do assistente e suas conversas são ' +
            'armazenados somente neste dispositivo. As chaves de API são mantidas no armazenamento criptografado do ' +
            'celular. As guias anônimas não salvam nada no celular, exceto os arquivos que você baixar nelas; ' +
            'suas conversas não são salvas.',
        },
        {
          heading: 'O que sai do seu celular, e para quem',
          body:
            '• Os sites que você visita recebem o que qualquer navegador lhes envia, e os dados que você pede ao ' +
            'assistente para digitar neles (como seu nome ou endereço em um formulário).\n' +
            '• Quando você usa o assistente, cada solicitação vai, com sua própria chave de API, para o serviço de ' +
            'IA que você configurou: diretamente para a Anthropic, a OpenAI ou o Google; para o OpenRouter, que a ' +
            'repassa ao provedor do modelo que você escolheu; ou para um servidor compatível com a OpenAI cujo ' +
            'endereço você informou. Uma solicitação contém sua mensagem, a conversa até o momento, o conteúdo de ' +
            'que o assistente precisa (o texto da página, capturas de tela quando ele olha uma página, arquivos e ' +
            'imagens que você anexa, o resultado de um script que você aprovou em uma página e, quando você pergunta ' +
            'sobre cookies, seus nomes, sites e configurações, nunca seus valores), suas instruções personalizadas ' +
            'e, enquanto a memória estiver ativada, suas memórias (memórias ocultas, como números de documentos de ' +
            'identidade, apenas como um rótulo). Seus eventos de calendário e sua localização são enviados somente quando você confirma, a ' +
            'cada vez, a menos que você tenha escolhido “Não perguntar mais” para eles (você pode ' +
            'desfazer isso em Configurações › Assistente › “Permitido sem perguntar”); em conversas ' +
            'com guias anônimas, eles nunca são usados. Se a pesquisa na web estiver ativada, o serviço pode fazer pesquisas ' +
            'para você. A política de privacidade e os termos desse serviço se aplicam a esses dados.\n' +
            '• Se as sugestões de pesquisa estiverem ativadas, o que você digita na barra de endereço é enviado ao ' +
            'seu mecanismo de pesquisa (nunca a partir de guias anônimas).\n' +
            '• Se você tocar em “Usar minha localização” na configuração inicial, sua posição aproximada é enviada ' +
            'ao serviço de endereços do celular {{ios:(o da Apple)|android:(geralmente o do Google)}} para ' +
            'encontrar o nome do lugar. Somente o nome do lugar é mantido.\n' +
            '• Se você falar com o assistente e o celular não conseguir reconhecer esse idioma no próprio aparelho, ' +
            'o áudio vai para o serviço de fala do celular {{ios:(da Apple)|android:(geralmente do Google)}}, somente depois que você tiver ' +
            'concordado uma vez no Qutai e nunca em conversas anônimas. O Qutai e o serviço de IA recebem apenas o ' +
            'texto.\n' +
            '• Quando o assistente mostra opções em forma de cartões, as imagens delas são carregadas dos sites (ou ' +
            'dos servidores de imagens dos sites) que as exibem, sem seus cookies, também para opções que você não ' +
            'abre; em conversas anônimas, somente quando você toca em “Mostrar imagens”.\n' +
            '• Enquanto “Bloquear anúncios e rastreadores” estiver ativado, as listas de filtros que você escolheu ' +
            'são baixadas de seus publicadores (como EasyList e AdGuard) e atualizadas a cada poucos dias. Essas ' +
            'solicitações não contêm nada sobre a sua navegação.\n' +
            'Nada mais é enviado: o Qutai não tem análises, rastreamento nem publicidade.',
        },
        {
          heading: 'Seus contatos',
          body:
            'Se você permitir, o assistente pode encontrar uma pessoa que você mencionar (por exemplo “ligue para o ' +
            'João”) nos contatos do seu celular. O Qutai procura somente os nomes que você mesmo diz, no seu ' +
            'celular; sua agenda nunca é enviada nem listada. O serviço de IA recebe apenas os nomes que ' +
            'correspondem e os tipos de número ou endereço que cada um tem (como “celular” ou “e-mail comercial”), ' +
            'nunca os próprios números ou endereços: você os vê no botão ou no rascunho, e você mesmo liga ou envia. ' +
            'Números e endereços dos seus contatos não são salvos com suas conversas, a memória do assistente ou ' +
            'seus backups. Os contatos não são usados em conversas com guias anônimas. Você pode alterar a permissão ' +
            'em Configurações.',
        },
        {
          heading: BLOCKING_HEADING,
          body: BLOCKING_PRIVACY_OPEN_SOURCE,
        },
        {
          heading: 'Senhas e dados de pagamento',
          body:
            'O Qutai não permite que a memória do assistente guarde senhas, números de cartão, códigos de segurança ' +
            'de cartão, datas de validade de cartão, códigos de uso único ou números de conta bancária (IBAN). ' +
            'Números de documento de identidade e de passaporte só podem ser guardados em identidade ou viagem; eles ' +
            'ficam ocultos para o serviço de IA, que vê apenas um rótulo, e o próprio Qutai digita o número em um ' +
            'site depois que você confirma. Antes de o assistente inserir pela primeira vez seus dados pessoais ' +
            'salvos em um site, o Qutai pergunta a você (você pode alterar isso para cada site). Você também pode ' +
            'exigir sua confirmação antes de cada ação e bloquear o assistente nos sites que escolher.',
        },
        {
          heading: 'Seu controle',
          body:
            'Você pode ver e excluir a memória do assistente, limpar o histórico, os cookies e outros dados em ' +
            'Configurações, e remover suas chaves de API a qualquer momento. Desinstalar o Qutai exclui tudo o que ele armazenou, exceto os arquivos que você salvou ' +
            'fora dele, como {{ios:arquivos salvos no app Arquivos|android:downloads na pasta Downloads do Android}} e imagens salvas nas suas Fotos.',
        },
        {
          heading: 'Crianças',
          body: 'O Qutai não se destina a crianças menores de 13 anos.',
        },
        {
          heading: 'Alterações',
          body:
            'Se esta política mudar, o Qutai mostra a nova versão e pede que você a aceite antes de continuar. Se ' +
            'esta tradução e a versão em inglês divergirem, prevalece a versão em inglês.',
        },
      ],
    },
    terms: {
      title: 'Termos de Uso',
      intro: 'Ao usar o Qutai, você concorda com estes termos. Leia-os junto com a Política de Privacidade.',
      sections: [
        {
          heading: 'Seu provedor de IA e os custos',
          body:
            'O assistente funciona com sua própria chave de API da Anthropic, da OpenAI, do Google ou do OpenRouter, ' +
            'ou com um servidor compatível com a OpenAI que você configurar. Usá-lo é um acordo entre você e esse ' +
            'serviço: os termos, a política de privacidade e os preços dele se aplicam, e você é responsável por sua ' +
            'conta nele e por todos os custos cobrados na sua chave. O Qutai não é parte desse acordo e não pode ' +
            'reembolsar esses custos.',
        },
        ...sharedTerms('Não use o Qutai, o assistente, estilos, scripts ou apps para:\n' + ACCEPTABLE_USE_BULLETS + '.'),
      ],
    },
  },
  pro: {
    privacy: {
      title: 'Política de Privacidade',
      intro:
        'O Qutai é um navegador web com um assistente de IA. Nós o criamos para que sua navegação fique no seu celular. O ' +
        'servidor próprio do Qutai é usado somente para sua conta Qutai (login, Qutai Credits, compras no app e backups), ' +
        'e somente quando você os escolhe. Não vendemos seus dados, e o Qutai não tem rastreamento nem publicidade; ' +
        'estatísticas de uso anônimas só são enviadas se você permitir.',
      sections: [
        {
          heading: 'Quem somos',
          body:
            'O Qutai é desenvolvido como código aberto. A equipe do Qutai (“nós”) é a controladora dos dados descritos nesta política. Para ' +
            'dúvidas sobre sua privacidade, ou para pedir uma cópia ou a eliminação do que o servidor do Qutai ' +
            'guarda sobre você, escreva para qutai@sonsuzdongu.com.',
        },
        {
          heading: 'O que fica no seu celular',
          body:
            'Suas guias, histórico, favoritos, páginas salvas, downloads, permissões de sites, a memória do ' +
            'assistente, o histórico de ações dele e suas conversas são armazenados somente neste dispositivo, ' +
            'também quando você está conectado à sua conta, a menos que você faça backup deles na sua conta Qutai ' +
            '(veja abaixo). As chaves de API e seu login são mantidos no armazenamento criptografado do celular. As guias anônimas não salvam nada no celular, exceto os arquivos que você baixar nelas; ' +
            'suas conversas não são salvas.',
        },
        {
          heading: 'O que sai do seu celular, e para quem',
          body:
            '• Os sites que você visita recebem o que qualquer navegador lhes envia, e os dados que você pede ao ' +
            'assistente para digitar neles (como seu nome ou endereço em um formulário).\n' +
            '• Com sua própria chave de API, sua mensagem e o conteúdo de que o assistente precisa (o texto da ' +
            'página, capturas de tela quando ele olha uma página, arquivos e imagens que você anexa, o resultado de ' +
            'um script que você aprovou em uma página, quando você pergunta sobre cookies seus nomes, sites e ' +
            'configurações, mas nunca seus valores, sua memória e suas instruções personalizadas) vão diretamente ' +
            'para o provedor de IA que você escolheu (Anthropic, OpenAI, Google, OpenRouter ou seu próprio ' +
            'servidor). O servidor do Qutai não participa. Seus eventos de calendário e sua localização são enviados somente quando você confirma, a ' +
            'cada vez, a menos que você tenha escolhido “Não perguntar mais” para eles (você pode ' +
            'desfazer isso em Configurações › Assistente › “Permitido sem perguntar”); em conversas ' +
            'com guias anônimas, eles nunca são usados.\n' +
            '• Com os Qutai Credits, o mesmo conteúdo vai primeiro para o servidor do Qutai, que o repassa ao ' +
            'provedor de IA (Anthropic, OpenAI ou Google) pela conta do próprio Qutai e envia a resposta de volta. O ' +
            'servidor do Qutai não armazena nem registra esse conteúdo. O app pergunta antes de você usar os Qutai ' +
            'Credits pela primeira vez.\n' +
            '• Se a pesquisa na web estiver ativada, o provedor de IA pode fazer pesquisas para você. As políticas ' +
            'de privacidade e os termos dos provedores se aplicam ao que eles recebem.\n' +
            '• Se as sugestões de pesquisa estiverem ativadas, o que você digita na barra de endereço é enviado ao ' +
            'seu mecanismo de pesquisa (nunca a partir de guias anônimas).\n' +
            '• Se você tocar em “Usar minha localização” na configuração inicial, sua posição aproximada é enviada ' +
            'ao serviço de endereços do celular {{ios:(o da Apple)|android:(geralmente o do Google)}} para ' +
            'encontrar o nome do lugar. Somente o nome do lugar é mantido.\n' +
            '• Se você falar com o assistente e o celular não conseguir reconhecer esse idioma no próprio aparelho, ' +
            'o áudio vai para o serviço de fala do celular {{ios:(da Apple)|android:(geralmente do Google)}}, somente depois que você tiver ' +
            'concordado uma vez no Qutai e nunca em conversas anônimas. O Qutai e o serviço de IA recebem apenas o ' +
            'texto.\n' +
            '• Quando o assistente mostra opções em forma de cartões, as imagens delas são carregadas dos sites (ou ' +
            'dos servidores de imagens dos sites) que as exibem, sem seus cookies, também para opções que você não ' +
            'abre; em conversas anônimas, somente quando você toca em “Mostrar imagens”.\n' +
            '• Enquanto “Bloquear anúncios e rastreadores” estiver ativado, as listas de filtros que você escolheu ' +
            'são baixadas de seus publicadores (como EasyList e AdGuard) e atualizadas a cada poucos dias. Essas ' +
            'solicitações não contêm nada sobre a sua navegação.\n• ' +
            'Se você denunciar uma resposta ou um app (⋮ › Denunciar), a denúncia vai para o servidor do Qutai: o motivo, sua nota, o texto da resposta ou o nome e o código do app só se você deixar “Incluir” marcado, se a resposta veio dos Créditos Qutai ou da sua própria chave, a versão do app, o sistema do celular e o idioma do app, e sua conta se você tiver entrado. As denúncias são guardadas por 180 dias e usadas apenas para encontrar e corrigir respostas e apps prejudiciais.',
        },
        {
          heading: 'Sua conta Qutai',
          body:
            'Uma conta é opcional; você só precisa de uma para os Qutai Credits, compras no app e backups na sua ' +
            'conta. Você faz login com a Apple, com o Google ou com seu endereço de e-mail. Com e-mail, enviamos uma ' +
            'mensagem com um código de uso único e um link para o endereço que você informar, por meio do nosso ' +
            'serviço de e-mail (Mailjet); o código vale por 10 minutos e somente no celular que o solicitou, e, para ' +
            'evitar abusos, o servidor conta quantos códigos são enviados para cada endereço e celular. O servidor ' +
            'do Qutai guarda: um número de conta; os métodos de login que a conta tem (Apple, Google, e-mail) e os ' +
            'endereços de e-mail que vêm com eles (com a Apple, pode ser um endereço de retransmissão privado); ' +
            'quando a conta foi criada e usada pela última vez; seus dispositivos conectados (um identificador ' +
            'aleatório do dispositivo, não os identificadores do seu celular); e seus créditos: o saldo, as compras ' +
            'e os créditos adicionados e, para cada solicitação ao assistente, o modelo, o número de tokens, quanto ' +
            'custou e quando. Ele não guarda suas mensagens, páginas nem respostas.',
        },
        {
          heading: 'Backups na sua conta Qutai',
          body:
            'Somente se você escolher (Configurações › Backup), o servidor do Qutai guarda seu arquivo de backup: os ' +
            'mesmos dados de um backup que você exporta (favoritos, histórico, a memória do assistente, tarefas ' +
            'salvas, configurações de sites e preferências; guias abertas, conversas, atividade e chaves de IA ' +
            'somente se você os incluir). Ele é criptografado no seu celular com uma senha que você escolhe antes de ' +
            'ser enviado; o Qutai não consegue lê-lo nem recuperar a senha, que fica guardada somente no seu ' +
            'celular. Com cada backup, o servidor também guarda quando ele foi feito, seu tamanho, a versão do app e ' +
            'o tipo de celular {{ios:(por exemplo “iPhone · iOS 26”)|android:(por exemplo “Android 16”)}}. Os backups mais recentes são mantidos (3 atualmente) ' +
            'e os mais antigos são excluídos; você pode excluí-los a qualquer momento, e excluir sua conta os exclui.',
        },
        {
          heading: 'Compras no app',
          body:
            'Os Qutai Credits e qualquer outra coisa vendida no app são comprados {{ios:pela App Store|android:pelo Google Play}}; seus dados de pagamento ficam com {{ios:a Apple|android:o Google}} e nunca chegam ao Qutai. Um serviço de ' +
            'pagamentos (RevenueCat) recebe o número da sua conta Qutai e o registro de compra da loja para que a ' +
            'compra possa ser confirmada, adicionada à sua conta e restaurada em outro celular. O Qutai mantém um ' +
            'registro de cada compra (loja, transação, produto, créditos, preço pago e datas), que a legislação ' +
            'tributária nos obriga a manter, também depois que a conta é excluída, sem o vínculo com você. Os ' +
            'reembolsos são tratados {{ios:pela Apple|android:pelo Google}} de acordo com as regras deles.',
        },
        {
          heading: 'O servidor do Qutai e quem mais trata dados',
          body:
            'O servidor do Qutai roda na Cloudflare, que também armazena os backups. Como qualquer servidor, ele vê ' +
            'seu endereço IP a cada solicitação; ele o usa somente para limitar quantas solicitações podem ser ' +
            'feitas, e os próprios registros (logs) do Qutai nunca contêm seu endereço IP, endereço de e-mail, ' +
            'mensagens, páginas ou tokens de login (eles guardam um identificador da solicitação, o número da sua ' +
            'conta, o que foi pedido, quanto tempo levou e, para solicitações ao assistente, o modelo, os tokens e o ' +
            'custo). As empresas que tratam dados para o Qutai, cada uma sob sua própria política de ' +
            'privacidade, são: Cloudflare (o servidor), {{ios:Apple (login e a App Store), Google (login)|android:Google (login e o Google Play), Apple (login)}}, Mailjet (e-mails de ' +
            'login), RevenueCat (compras) e, com os Qutai Credits, Anthropic, OpenAI e Google (a IA). Não ' +
            'compartilhamos seus dados com mais ninguém, exceto quando a lei exige (por exemplo, uma ordem judicial) ' +
            'ou para proteger o Qutai e seus usuários contra fraudes e abusos.',
        },
        {
          heading: 'Prazo de armazenamento dos dados',
          body:
            'No seu celular: até você excluí-los ou desinstalar o Qutai. No servidor do Qutai: sua conta, seus ' +
            'métodos de login, dispositivos e histórico de créditos até você excluir a conta; backups conforme ' +
            'descrito acima; códigos de login até serem usados ou expirarem; registros de compras pelo tempo que a ' +
            'legislação tributária exigir, sem o vínculo com você depois que a conta for excluída.',
        },
        {
          heading: 'Estatísticas de uso anônimas (só se você permitir)',
          body:
            'O Qutai pergunta uma vez se pode enviar estatísticas de uso anônimas. Nada é enviado a menos que você toque em ' +
            'Permitir, e você pode mudar sua resposta a qualquer momento em Configurações › Privacidade e segurança. Se você ' +
            'permitir, o app envia ao servidor do Qutai alguns dados fixos: quais recursos são usados, que a configuração foi ' +
            'concluída, que uma tarefa do assistente terminou ou falhou (só com o tipo de erro, como um erro de rede) e que a ' +
            'tela de compra de créditos foi aberta, junto com a versão do app, {{ios:que é um iPhone|android:que é ' +
            'Android|web:o tipo de celular}}, o idioma do app e um número aleatório criado para isso no seu celular. Esse ' +
            'número não está ligado à sua conta, ao seu login nem a outro identificador, e é apagado quando você desativa a ' +
            'opção; o servidor guarda apenas uma forma encurtada e embaralhada dele. Nada é enviado de abas ou conversas ' +
            'anônimas, e nunca endereços da web, conteúdo de páginas, pesquisas, o que você escreve ou a memória do ' +
            'assistente. O Qutai não usa identificador de publicidade e não acompanha você entre apps ou sites. As ' +
            'estatísticas ficam armazenadas na Cloudflare por três meses.',
        },
        {
          heading: 'Verificação de solicitações e prevenção de abuso',
          body:
            'Para proteger os Qutai Credits de abuso, quando você faz login e quando o assistente usa Qutai Credits, o app ' +
            'pede {{ios:ao serviço App Attest da Apple|android:ao serviço de integridade do Google Play|web:ao serviço App ' +
            'Attest da Apple no iPhone ou ao serviço de integridade do Google Play no Android}} que confirme que a ' +
            'solicitação vem do app Qutai genuíno em um dispositivo real, e envia essa confirmação ao servidor do Qutai. ' +
            '{{ios:A Apple recebe uma chave criada para isso no seu celular e um resumo da solicitação; o servidor do Qutai ' +
            'guarda a parte pública da chave e um contador, sem ligá-los à sua conta, e os apaga após 180 dias sem ' +
            'uso.|android:O Google recebe um resumo da solicitação e verifica o app e o dispositivo; o servidor do Qutai ' +
            'guarda só o resultado, com sua sessão de login, por até uma hora.|web:A Apple ou o Google recebe um resumo da ' +
            'solicitação; o servidor do Qutai guarda apenas o necessário para a verificação, sem ligá-lo à sua conta.}} A ' +
            'verificação nunca inclui o conteúdo das suas solicitações. O servidor do Qutai também conta, por dia, quantas ' +
            'solicitações foram recusadas pelos seus limites ou não passaram nesta verificação, e para cada conta com que ' +
            'frequência isso aconteceu; essas contagens são guardadas por 30 dias. Uma conta pode ser marcada para análise ' +
            'por uma pessoa do Qutai (por exemplo, após muitas solicitações recusadas ou o reembolso de créditos já gastos); ' +
            'uma marcação não bloqueia nada por si só e é apagada com a conta.',
        },
        {
          heading: 'Seus contatos',
          body:
            'Se você permitir, o assistente pode encontrar uma pessoa que você mencionar (por exemplo “ligue para o ' +
            'João”) nos contatos do seu celular. O Qutai procura somente os nomes que você mesmo diz, no seu ' +
            'celular; sua agenda nunca é enviada nem listada. O serviço de IA recebe apenas os nomes que ' +
            'correspondem e os tipos de número ou endereço que cada um tem (como “celular” ou “e-mail comercial”), ' +
            'nunca os próprios números ou endereços: você os vê no botão ou no rascunho, e você mesmo liga ou envia. ' +
            'Números e endereços dos seus contatos não são salvos com suas conversas, a memória do assistente ou ' +
            'seus backups. Os contatos não são usados em conversas com guias anônimas. Você pode alterar a permissão ' +
            'em Configurações.',
        },
        {
          heading: BLOCKING_HEADING,
          body: BLOCKING_PRIVACY_PRO,
        },
        {
          heading: 'Senhas e dados de pagamento',
          body:
            'O Qutai não permite que a memória do assistente guarde senhas, números de cartão, códigos de segurança ' +
            'de cartão, datas de validade de cartão, códigos de uso único ou números de conta bancária (IBAN). ' +
            'Números de documento de identidade e de passaporte só podem ser guardados em identidade ou viagem; eles ' +
            'ficam ocultos para o serviço de IA, que vê apenas um rótulo, e o próprio Qutai digita o número em um ' +
            'site depois que você confirma. Antes de o assistente inserir pela primeira vez seus dados pessoais ' +
            'salvos em um site, o Qutai pergunta a você (você pode alterar isso para cada site). Você também pode ' +
            'exigir sua confirmação antes de cada ação e bloquear o assistente nos sites que escolher.',
        },
        {
          heading: 'Seu controle',
          body:
            'Você pode ver e excluir a memória do assistente, limpar o histórico, os cookies e outros dados em ' +
            'Configurações, e remover suas chaves de API a qualquer momento. Você pode excluir seus backups do ' +
            'servidor do Qutai em Configurações › Backup. Você pode deixar de usar os Qutai Credits, sair da conta ' +
            'ou excluir sua conta em Configurações › Conta: a exclusão remove a conta, o saldo e o histórico dela do ' +
            'servidor do Qutai (os registros de compras permanecem sem o vínculo com você, como acima) e pede ao ' +
            'serviço de pagamentos que exclua o registro que tem sobre você. Você também pode escrever para ' +
            'qutai@sonsuzdongu.com para pedir uma cópia do que o servidor do Qutai guarda sobre você, ou a correção ' +
            'ou eliminação desses dados. Desinstalar o Qutai exclui tudo o que ele armazenou no celular, exceto os arquivos que ' +
            'você salvou fora dele, como {{ios:arquivos salvos no app Arquivos|android:downloads na pasta Downloads do Android}} e imagens salvas nas ' +
            'suas Fotos.',
        },
        {
          heading: 'Segurança',
          body:
            'As conexões com o servidor do Qutai usam HTTPS. Os tokens de login são mantidos no servidor somente em ' +
            'forma de hash e no seu celular no armazenamento criptografado dele, e os backups são criptografados no ' +
            'seu celular antes de serem enviados.',
        },
        {
          heading: 'Crianças',
          body:
            'O Qutai não se destina a crianças menores de 13 anos, e não coletamos dados delas intencionalmente. Em ' +
            'alguns países, você precisa ter mais idade (por exemplo, 16 anos) para concordar com esta política por ' +
            'conta própria; abaixo dessa idade, um dos pais ou o responsável legal precisa dar o consentimento por ' +
            'você.',
        },
        {
          heading: 'Alterações',
          body:
            'Se esta política mudar, o Qutai mostra a nova versão e pede que você a aceite antes de continuar. Se ' +
            'esta tradução e a versão em inglês divergirem, prevalece a versão em inglês.',
        },
      ],
    },
    terms: {
      title: 'Termos de Uso',
      intro: 'Ao usar o Qutai, você concorda com estes termos. Leia-os junto com a Política de Privacidade.',
      sections: [
        {
          heading: 'Duas formas de usar o assistente',
          body:
            '• Sua própria chave de API: usá-la é um acordo entre você e esse provedor. Os termos, a política de ' +
            'privacidade e os preços dele se aplicam, e você é responsável por sua conta nele e por todos os custos ' +
            'cobrados na sua chave; ' +
            NOT_A_PARTY +
            '\n' +
            '• Qutai Credits: as solicitações do assistente passam pelo servidor do Qutai e são pagas com créditos ' +
            'da sua conta Qutai. Você precisa de uma conta para usá-los.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Os créditos são comprados no app {{ios:pela App Store|android:pelo Google Play}}, ao preço que a loja mostra, e são ' +
            'adicionados à sua conta Qutai assim que a compra é confirmada. Eles pagam somente as solicitações do ' +
            'assistente no Qutai, aos preços em créditos mostrados para cada modelo; quanto custou cada resposta é ' +
            'mostrado abaixo dela. Uma solicitação primeiro reserva o máximo que poderia custar e devolve o que não ' +
            'usou. Os créditos pertencem à sua conta Qutai, podem ser usados em qualquer celular em que você fizer ' +
            'login, não podem ser transferidos nem trocados por dinheiro e não são reembolsados, exceto quando a lei ' +
            'ou as regras de reembolso da loja o exigirem; os reembolsos são tratados {{ios:pela Apple|android:pelo Google}}. Se ' +
            'uma compra for reembolsada, os créditos dela são retirados, o que pode deixar o saldo negativo até você ' +
            'recarregá-lo. Os créditos não expiram. Os modelos, os preços em créditos e os limites podem mudar; os atuais são mostrados no ' +
            'app antes de você usá-los. Os Qutai Credits podem ser pausados para manutenção ou ficar indisponíveis ' +
            'em alguns momentos.',
        },
        {
          heading: 'Sua conta',
          body:
            'Mantenha seu login (Apple, Google ou seu e-mail) seguro; o que é feito com sua conta é de sua ' +
            'responsabilidade. Podemos suspender uma conta que viole estes termos. Se você excluir sua conta, os ' +
            'créditos restantes dela serão perdidos.',
        },
        ...sharedTerms(
          'Não use o Qutai, os Qutai Credits, o assistente, estilos, scripts ou apps para:\n' +
            ACCEPTABLE_USE_BULLETS +
            ';\n' +
            '• usar indevidamente, atacar ou sobrecarregar o servidor do Qutai.\n' +
            'Podemos suspender uma conta usada dessas formas.',
        ),
      ],
    },
  },
};
