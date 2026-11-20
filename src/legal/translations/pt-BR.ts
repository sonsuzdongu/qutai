import type { LegalTranslation } from '../documents';

/**
 * Brazilian Portuguese translation of the privacy policy and terms of both builds, machine-translated from English on
 * 20 Nov 2026 and not yet reviewed by a native speaker or a lawyer. The English version prevails.
 */
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
            'celular. As guias anônimas não gravam nada no disco; suas conversas não são salvas.',
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
            'identidade, apenas como um rótulo). Seus eventos de calendário e sua localização são enviados somente ' +
            'quando você confirma, a cada vez. Se a pesquisa na web estiver ativada, o serviço pode fazer pesquisas ' +
            'para você. A política de privacidade e os termos desse serviço se aplicam a esses dados.\n' +
            '• Se as sugestões de pesquisa estiverem ativadas, o que você digita na barra de endereço é enviado ao ' +
            'seu mecanismo de pesquisa (nunca a partir de guias anônimas).\n' +
            '• Se você tocar em “Usar minha localização” na configuração inicial, sua posição aproximada é enviada ' +
            'ao serviço de endereços do celular (o da Apple em um iPhone; no Android, geralmente o do Google) para ' +
            'encontrar o nome do lugar. Somente o nome do lugar é mantido.\n' +
            '• Se você falar com o assistente e o celular não conseguir reconhecer esse idioma no próprio aparelho, ' +
            'o áudio vai para o serviço de fala do celular (da Apple ou do Google), somente depois que você tiver ' +
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
            'Configurações, e remover suas chaves de API a qualquer momento. Desinstalar o Qutai exclui tudo o que ' +
            'ele armazenou.',
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
            'ou com um servidor compatível com a OpenAI que você configurar. Você é responsável por sua conta nesse ' +
            'serviço, pelos termos dele e por todos os custos cobrados na sua chave.',
        },
        {
          heading: 'O assistente age em seu nome',
          body:
            'O assistente pode ler páginas, clicar, digitar e preencher formulários quando você pede. A IA pode ' +
            'cometer erros: confira as respostas dele e revise compras, reservas, mensagens e outras ações ' +
            'importantes antes que sejam concluídas. Você pode exigir confirmação antes de cada ação em ' +
            'Configurações.',
        },
        {
          heading: 'Uso aceitável',
          body:
            'Não use o Qutai para violar a lei, para violar os termos de sites ou de provedores de IA, nem para ' +
            'prejudicar outras pessoas, por exemplo enviando spam ou coletando dados de terceiros.',
        },
        {
          heading: 'Sites e conteúdo',
          body: 'Os sites e seu conteúdo pertencem a seus proprietários. O Qutai não é responsável por eles.',
        },
        {
          heading: 'Ausência de garantia',
          body:
            'O Qutai é fornecido “no estado em que se encontra”, sem garantias. Na medida permitida pela lei, não ' +
            'nos responsabilizamos por perdas decorrentes do seu uso, incluindo ações realizadas pelo assistente.',
        },
        {
          heading: 'Alterações',
          body:
            'Se estes termos mudarem, o Qutai mostra a nova versão e pede que você a aceite antes de continuar. Se ' +
            'esta tradução e a versão em inglês divergirem, prevalece a versão em inglês.',
        },
      ],
    },
  },
  pro: {
    privacy: {
      title: 'Política de Privacidade',
      intro:
        'O Qutai é um navegador web com um assistente de IA. Nós o criamos para que sua navegação fique no seu ' +
        'celular. O servidor próprio do Qutai é usado somente para sua conta Qutai (login, Qutai Credits, compras no ' +
        'app e backups), e somente quando você os escolhe. Não vendemos seus dados, e o Qutai não tem análises, ' +
        'rastreamento nem publicidade.',
      sections: [
        {
          heading: 'Quem somos',
          body:
            'O Qutai é feito por Osman Yuksel (“nós”), que é o controlador dos dados descritos nesta política. Para ' +
            'dúvidas sobre sua privacidade, ou para pedir uma cópia ou a eliminação do que o servidor do Qutai ' +
            'guarda sobre você, escreva para osmanyuksel@gmail.com.',
        },
        {
          heading: 'O que fica no seu celular',
          body:
            'Suas guias, histórico, favoritos, páginas salvas, downloads, permissões de sites, a memória do ' +
            'assistente, o histórico de ações dele e suas conversas são armazenados somente neste dispositivo, ' +
            'também quando você está conectado à sua conta, a menos que você faça backup deles na sua conta Qutai ' +
            '(veja abaixo). As chaves de API e seu login são mantidos no armazenamento criptografado do celular. As ' +
            'guias anônimas não gravam nada no disco; suas conversas não são salvas.',
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
            'servidor). O servidor do Qutai não participa. Seus eventos de calendário e sua localização são enviados ' +
            'somente quando você confirma, a cada vez.\n' +
            '• Com os Qutai Credits, o mesmo conteúdo vai primeiro para o servidor do Qutai, que o repassa ao ' +
            'provedor de IA (Anthropic, OpenAI ou Google) pela conta do próprio Qutai e envia a resposta de volta. O ' +
            'servidor do Qutai não armazena nem registra esse conteúdo. O app pergunta antes de você usar os Qutai ' +
            'Credits pela primeira vez.\n' +
            '• Se a pesquisa na web estiver ativada, o provedor de IA pode fazer pesquisas para você. As políticas ' +
            'de privacidade e os termos dos provedores se aplicam ao que eles recebem.\n' +
            '• Se as sugestões de pesquisa estiverem ativadas, o que você digita na barra de endereço é enviado ao ' +
            'seu mecanismo de pesquisa (nunca a partir de guias anônimas).\n' +
            '• Se você tocar em “Usar minha localização” na configuração inicial, sua posição aproximada é enviada ' +
            'ao serviço de endereços do celular (o da Apple em um iPhone; no Android, geralmente o do Google) para ' +
            'encontrar o nome do lugar. Somente o nome do lugar é mantido.\n' +
            '• Se você falar com o assistente e o celular não conseguir reconhecer esse idioma no próprio aparelho, ' +
            'o áudio vai para o serviço de fala do celular (da Apple ou do Google), somente depois que você tiver ' +
            'concordado uma vez no Qutai e nunca em conversas anônimas. O Qutai e o serviço de IA recebem apenas o ' +
            'texto.\n' +
            '• Quando o assistente mostra opções em forma de cartões, as imagens delas são carregadas dos sites (ou ' +
            'dos servidores de imagens dos sites) que as exibem, sem seus cookies, também para opções que você não ' +
            'abre; em conversas anônimas, somente quando você toca em “Mostrar imagens”.\n' +
            '• Enquanto “Bloquear anúncios e rastreadores” estiver ativado, as listas de filtros que você escolheu ' +
            'são baixadas de seus publicadores (como EasyList e AdGuard) e atualizadas a cada poucos dias. Essas ' +
            'solicitações não contêm nada sobre a sua navegação.',
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
            'o tipo de celular (por exemplo “iPhone · iOS 26”). Os backups mais recentes são mantidos (3 atualmente) ' +
            'e os mais antigos são excluídos; você pode excluí-los a qualquer momento, e excluir sua conta os exclui.',
        },
        {
          heading: 'Compras no app',
          body:
            'Os Qutai Credits e qualquer outra coisa vendida no app são comprados pela App Store ou pelo Google ' +
            'Play; seus dados de pagamento ficam com a Apple ou o Google e nunca chegam ao Qutai. Um serviço de ' +
            'pagamentos (RevenueCat) recebe o número da sua conta Qutai e o registro de compra da loja para que a ' +
            'compra possa ser confirmada, adicionada à sua conta e restaurada em outro celular. O Qutai mantém um ' +
            'registro de cada compra (loja, transação, produto, créditos, preço pago e datas), que a legislação ' +
            'tributária nos obriga a manter, também depois que a conta é excluída, sem o vínculo com você. Os ' +
            'reembolsos são tratados pela Apple ou pelo Google de acordo com as regras deles.',
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
            'privacidade, são: Cloudflare (o servidor), Apple e Google (login e as lojas), Mailjet (e-mails de ' +
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
            'osmanyuksel@gmail.com para pedir uma cópia do que o servidor do Qutai guarda sobre você, ou a correção ' +
            'ou eliminação desses dados. Desinstalar o Qutai exclui tudo o que ele armazenou no celular.',
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
            '• Sua própria chave de API: você é responsável por sua conta nesse provedor, pelos termos dele e por ' +
            'todos os custos cobrados na sua chave.\n' +
            '• Qutai Credits: as solicitações do assistente passam pelo servidor do Qutai e são pagas com créditos ' +
            'da sua conta Qutai. Você precisa de uma conta para usá-los.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Os créditos são comprados no app pela App Store ou pelo Google Play, ao preço que a loja mostra, e são ' +
            'adicionados à sua conta Qutai assim que a compra é confirmada. Eles pagam somente as solicitações do ' +
            'assistente no Qutai, aos preços em créditos mostrados para cada modelo; quanto custou cada resposta é ' +
            'mostrado abaixo dela. Uma solicitação primeiro reserva o máximo que poderia custar e devolve o que não ' +
            'usou. Os créditos pertencem à sua conta Qutai, podem ser usados em qualquer celular em que você fizer ' +
            'login, não podem ser transferidos nem trocados por dinheiro e não são reembolsados, exceto quando a lei ' +
            'ou as regras de reembolso da loja o exigirem; os reembolsos são tratados pela Apple ou pelo Google. Se ' +
            'uma compra for reembolsada, os créditos dela são retirados, o que pode deixar o saldo negativo até você ' +
            'recarregá-lo. Os modelos, os preços em créditos e os limites podem mudar; os atuais são mostrados no ' +
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
        {
          heading: 'O assistente age em seu nome',
          body:
            'O assistente pode ler páginas, clicar, digitar e preencher formulários quando você pede. A IA pode ' +
            'cometer erros: confira as respostas dele e revise compras, reservas, mensagens e outras ações ' +
            'importantes antes que sejam concluídas. Você pode exigir confirmação antes de cada ação em ' +
            'Configurações.',
        },
        {
          heading: 'Uso aceitável',
          body:
            'Não use o Qutai nem os Qutai Credits para violar a lei, para violar os termos de sites ou de provedores ' +
            'de IA, para prejudicar outras pessoas (por exemplo, enviando spam ou coletando dados de terceiros) nem ' +
            'para usar indevidamente ou sobrecarregar o servidor do Qutai.',
        },
        {
          heading: 'Sites e conteúdo',
          body: 'Os sites e seu conteúdo pertencem a seus proprietários. O Qutai não é responsável por eles.',
        },
        {
          heading: 'Ausência de garantia',
          body:
            'O Qutai é fornecido “no estado em que se encontra”, sem garantias. Na medida permitida pela lei, não ' +
            'nos responsabilizamos por perdas decorrentes do seu uso, incluindo ações realizadas pelo assistente.',
        },
        {
          heading: 'Alterações',
          body:
            'Se estes termos mudarem, o Qutai mostra a nova versão e pede que você a aceite antes de continuar. Se ' +
            'esta tradução e a versão em inglês divergirem, prevalece a versão em inglês.',
        },
      ],
    },
  },
};
