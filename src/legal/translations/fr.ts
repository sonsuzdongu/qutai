import type { LegalTranslation } from '../documents';

/**
 * French translation of the privacy policy and terms of both builds, machine-translated from English on 20 Nov 2026
 * and not yet reviewed by a native speaker or a lawyer. The English version prevails.
 */
export const fr: LegalTranslation = {
  openSource: {
    privacy: {
      title: 'Politique de confidentialité',
      intro:
        'Qutai est un navigateur web doté d’un assistant IA. Nous l’avons conçu pour que votre navigation reste sur ' +
        'votre téléphone. Qutai n’a pas de serveurs propres : nous ne collectons, ne stockons ni ne vendons vos ' +
        'données.',
      sections: [
        {
          heading: 'Ce qui reste sur votre téléphone',
          body:
            'Vos onglets, votre historique, vos favoris, vos pages enregistrées, vos téléchargements, les ' +
            'autorisations des sites, la mémoire de l’assistant (y compris vos réponses aux questions facultatives ' +
            'de configuration et le formulaire d’adresse), vos instructions personnalisées, l’historique des actions ' +
            'de l’assistant et vos conversations sont stockés uniquement sur cet appareil. Les clés API sont ' +
            'conservées dans le stockage chiffré du téléphone. Les onglets privés n’enregistrent rien sur le téléphone, sauf les fichiers que vous y ' +
            'téléchargez ; leurs conversations ne sont pas enregistrées.',
        },
        {
          heading: 'Ce qui quitte votre téléphone, et vers qui',
          body:
            '• Les sites web que vous visitez reçoivent ce que tout navigateur leur envoie, ainsi que les ' +
            'informations que vous demandez à l’assistant d’y saisir (comme votre nom ou votre adresse dans un ' +
            'formulaire).\n' +
            '• Lorsque vous utilisez l’assistant, chaque requête est envoyée avec votre propre clé API au service ' +
            'd’IA que vous avez configuré : directement à Anthropic, OpenAI ou Google ; à OpenRouter, qui la ' +
            'transmet au fournisseur du modèle que vous avez choisi ; ou à un serveur compatible OpenAI dont vous ' +
            'avez saisi l’adresse. Une requête contient votre message, la conversation jusque-là, le contenu dont ' +
            'l’assistant a besoin (le texte de la page, des captures d’écran lorsqu’il regarde une page, les ' +
            'fichiers et images que vous joignez, le résultat d’un script que vous avez approuvé sur une page et, ' +
            'lorsque vous posez une question sur les cookies, leurs noms, leurs sites et leurs paramètres, jamais ' +
            'leurs valeurs), vos instructions personnalisées et, tant que la mémoire est activée, vos souvenirs (les ' +
            'souvenirs masqués, comme les numéros d’identité, uniquement sous forme d’étiquette). Vos événements d’agenda et votre position ne sont envoyés que lorsque vous le confirmez, ' +
            'à chaque fois, sauf si vous avez choisi « Ne plus demander » pour eux (vous pouvez ' +
            'l’annuler dans Paramètres › Assistant › « Autorisé sans demander ») ; dans les ' +
            'conversations avec des onglets privés, ils ne sont jamais utilisés. Si la ' +
            'recherche web est activée, le service peut effectuer des recherches pour vous. La politique de ' +
            'confidentialité et les conditions de ce service s’appliquent à ces données.\n' +
            '• Si les suggestions de recherche sont activées, ce que vous tapez dans la barre d’adresse est envoyé à ' +
            'votre moteur de recherche (jamais depuis les onglets privés).\n' +
            '• Si vous touchez « Utiliser ma position » lors de la configuration, votre position approximative est ' +
            'envoyée au service d’adresses du téléphone (celui d’Apple sur un iPhone ; sur Android, généralement ' +
            'celui de Google) pour trouver le nom du lieu. Seul le nom du lieu est conservé.\n' +
            '• Si vous parlez à l’assistant et que le téléphone ne peut pas reconnaître cette langue sur l’appareil ' +
            'lui-même, l’audio est envoyé au service de reconnaissance vocale du téléphone (celui d’Apple ou de ' +
            'Google), uniquement après que vous l’avez accepté une fois dans Qutai, et jamais dans les conversations ' +
            'privées. Qutai et le service d’IA ne reçoivent que le texte.\n' +
            '• Lorsque l’assistant vous présente des options sous forme de cartes, leurs images sont chargées depuis ' +
            'les sites (ou les serveurs d’images des sites) qui les affichent, sans vos cookies, y compris pour les ' +
            'options que vous n’ouvrez pas ; dans les conversations privées, uniquement lorsque vous touchez ' +
            '« Afficher les images ».\n' +
            '• Tant que « Bloquer les publicités et les traceurs » est activé, les listes de filtres que vous avez ' +
            'choisies sont téléchargées auprès de leurs éditeurs (comme EasyList et AdGuard) et mises à jour à ' +
            'quelques jours d’intervalle. Ces requêtes ne contiennent rien sur votre navigation.\n' +
            'Rien d’autre n’est envoyé : Qutai n’a ni outil d’analyse, ni pistage, ni publicité.',
        },
        {
          heading: 'Vos contacts',
          body:
            'Si vous l’autorisez, l’assistant peut trouver une personne que vous nommez (par exemple « appelle ' +
            'Thomas ») dans les contacts de votre téléphone. Qutai recherche uniquement les noms que vous dites ' +
            'vous-même, sur votre téléphone ; votre carnet d’adresses n’est jamais téléversé ni listé. Le service ' +
            'd’IA ne reçoit que les noms correspondants et le type de numéro ou d’adresse associé à chacun (comme ' +
            '« mobile » ou « e-mail professionnel »), jamais les numéros ou adresses eux-mêmes : vous les voyez sur ' +
            'le bouton ou le brouillon, et c’est vous qui appelez ou envoyez. Les numéros et adresses de vos ' +
            'contacts ne sont pas enregistrés avec vos conversations, la mémoire de l’assistant ou vos sauvegardes. ' +
            'Les contacts ne sont pas utilisés dans les conversations avec des onglets privés. Vous pouvez modifier ' +
            'l’autorisation dans Paramètres.',
        },
        {
          heading: 'Mots de passe et données de paiement',
          body:
            'Qutai ne permet pas à la mémoire de l’assistant de conserver des mots de passe, numéros de carte, codes ' +
            'de sécurité de carte, dates d’expiration de carte, codes à usage unique ou numéros de compte bancaire ' +
            '(IBAN). Les numéros de pièce d’identité et de passeport ne peuvent être conservés que dans les ' +
            'catégories identité ou voyage ; ils sont masqués pour le service d’IA, qui ne voit qu’une étiquette, et ' +
            'Qutai saisit lui-même le numéro sur un site après votre confirmation. Avant que l’assistant ne saisisse ' +
            'pour la première fois vos données personnelles enregistrées sur un site, Qutai vous le demande (vous ' +
            'pouvez modifier ce réglage pour chaque site). Vous pouvez aussi exiger votre confirmation avant chaque ' +
            'action, et bloquer l’assistant sur les sites de votre choix.',
        },
        {
          heading: 'Vos moyens de contrôle',
          body:
            'Vous pouvez consulter et supprimer la mémoire de l’assistant, effacer l’historique, les cookies et ' +
            'd’autres données dans Paramètres, et supprimer vos clés API à tout moment. La désinstallation de Qutai supprime tout ce qu’il a stocké, sauf les fichiers que vous ' +
            'avez enregistrés en dehors de l’application, comme les téléchargements dans le dossier ' +
            'Téléchargements d’Android et les images enregistrées dans vos Photos.',
        },
        {
          heading: 'Enfants',
          body: 'Qutai ne s’adresse pas aux enfants de moins de 13 ans.',
        },
        {
          heading: 'Modifications',
          body:
            'Si cette politique change, Qutai affiche la nouvelle version et vous demande de l’accepter avant de ' +
            'continuer. En cas de divergence entre cette traduction et la version anglaise, la version anglaise ' +
            'prévaut.',
        },
      ],
    },
    terms: {
      title: 'Conditions d’utilisation',
      intro:
        'En utilisant Qutai, vous acceptez les présentes conditions. Veuillez les lire conjointement avec la ' +
        'Politique de confidentialité.',
      sections: [
        {
          heading: 'Votre fournisseur d’IA et les coûts',
          body:
            'L’assistant fonctionne avec votre propre clé API d’Anthropic, OpenAI, Google ou OpenRouter, ou avec un ' +
            'serveur compatible OpenAI que vous avez configuré. Vous êtes responsable de votre compte auprès de ce ' +
            'service, de ses conditions et de tous les coûts facturés sur votre clé.',
        },
        {
          heading: 'L’assistant agit pour votre compte',
          body:
            'L’assistant peut lire des pages, cliquer, saisir du texte et remplir des formulaires lorsque vous le ' +
            'lui demandez. L’IA peut faire des erreurs : vérifiez ses réponses, et contrôlez les achats, ' +
            'réservations, messages et autres actions importantes avant qu’ils ne soient finalisés. Vous pouvez ' +
            'exiger une confirmation avant chaque action dans Paramètres.',
        },
        {
          heading: 'Utilisation acceptable',
          body:
            'N’utilisez pas Qutai pour enfreindre la loi, pour enfreindre les conditions des sites web ou des ' +
            'fournisseurs d’IA, ou pour nuire à autrui, par exemple en envoyant du spam ou en collectant les données ' +
            'd’autres personnes.',
        },
        {
          heading: 'Sites web et contenus',
          body: 'Les sites web et leurs contenus appartiennent à leurs propriétaires. Qutai n’en est pas responsable.',
        },
        {
          heading: 'Absence de garantie',
          body:
            'Qutai est fourni « en l’état », sans garantie. Dans la mesure permise par la loi, nous ne sommes pas ' +
            'responsables des pertes résultant de son utilisation, y compris des actions effectuées par l’assistant.',
        },
        {
          heading: 'Modifications',
          body:
            'Si ces conditions changent, Qutai affiche la nouvelle version et vous demande de l’accepter avant de ' +
            'continuer. En cas de divergence entre cette traduction et la version anglaise, la version anglaise ' +
            'prévaut.',
        },
      ],
    },
  },
  pro: {
    privacy: {
      title: 'Politique de confidentialité',
      intro:
        'Qutai est un navigateur web doté d’un assistant IA. Nous l’avons conçu pour que votre navigation reste sur ' +
        'votre téléphone. Le serveur propre de Qutai n’est utilisé que pour votre compte Qutai (connexion, Qutai ' +
        'Credits, achats dans l’application et sauvegardes), et uniquement lorsque vous les choisissez. Nous ne ' +
        'vendons pas vos données, et Qutai n’a ni outil d’analyse, ni pistage, ni publicité.',
      sections: [
        {
          heading: 'Qui nous sommes',
          body:
            'Qutai est développé par Osman Yuksel (« nous »), responsable du traitement des données décrites dans la ' +
            'présente politique. Pour toute question relative à votre vie privée, ou pour demander une copie ou ' +
            'l’effacement de ce que le serveur de Qutai conserve à votre sujet, écrivez à osmanyuksel@gmail.com.',
        },
        {
          heading: 'Ce qui reste sur votre téléphone',
          body:
            'Vos onglets, votre historique, vos favoris, vos pages enregistrées, vos téléchargements, les ' +
            'autorisations des sites, la mémoire de l’assistant, l’historique de ses actions et vos conversations ' +
            'sont stockés uniquement sur cet appareil, y compris lorsque vous êtes connecté, sauf si vous les ' +
            'sauvegardez dans votre compte Qutai (voir ci-dessous). Les clés API et votre connexion sont conservées ' +
            'dans le stockage chiffré du téléphone. Les onglets privés n’enregistrent rien sur le téléphone, sauf les fichiers que vous y ' +
            'téléchargez ; leurs conversations ne sont pas enregistrées.',
        },
        {
          heading: 'Ce qui quitte votre téléphone, et vers qui',
          body:
            '• Les sites web que vous visitez reçoivent ce que tout navigateur leur envoie, ainsi que les ' +
            'informations que vous demandez à l’assistant d’y saisir (comme votre nom ou votre adresse dans un ' +
            'formulaire).\n' +
            '• Avec votre propre clé API, votre message et le contenu dont l’assistant a besoin (le texte de la ' +
            'page, des captures d’écran lorsqu’il regarde une page, les fichiers et images que vous joignez, le ' +
            'résultat d’un script que vous avez approuvé sur une page, lorsque vous posez une question sur les ' +
            'cookies leurs noms, sites et paramètres mais jamais leurs valeurs, votre mémoire et vos instructions ' +
            'personnalisées) sont envoyés directement au fournisseur d’IA que vous avez choisi (Anthropic, OpenAI, ' +
            'Google, OpenRouter ou votre propre serveur). Le serveur de Qutai n’intervient pas. Vos événements d’agenda et votre position ne sont envoyés que lorsque vous le confirmez, ' +
            'à chaque fois, sauf si vous avez choisi « Ne plus demander » pour eux (vous pouvez ' +
            'l’annuler dans Paramètres › Assistant › « Autorisé sans demander ») ; dans les ' +
            'conversations avec des onglets privés, ils ne sont jamais utilisés.\n' +
            '• Avec les Qutai Credits, le même contenu est d’abord envoyé au serveur de Qutai, qui le transmet au ' +
            'fournisseur d’IA (Anthropic, OpenAI ou Google) sous le propre compte de Qutai et vous renvoie la ' +
            'réponse. Le serveur de Qutai ne stocke ni ne journalise ce contenu. L’application vous pose la question ' +
            'avant que vous n’utilisiez les Qutai Credits pour la première fois.\n' +
            '• Si la recherche web est activée, le fournisseur d’IA peut effectuer des recherches pour vous. Les ' +
            'politiques de confidentialité et les conditions des fournisseurs s’appliquent à ce qu’ils reçoivent.\n' +
            '• Si les suggestions de recherche sont activées, ce que vous tapez dans la barre d’adresse est envoyé à ' +
            'votre moteur de recherche (jamais depuis les onglets privés).\n' +
            '• Si vous touchez « Utiliser ma position » lors de la configuration, votre position approximative est ' +
            'envoyée au service d’adresses du téléphone (celui d’Apple sur un iPhone ; sur Android, généralement ' +
            'celui de Google) pour trouver le nom du lieu. Seul le nom du lieu est conservé.\n' +
            '• Si vous parlez à l’assistant et que le téléphone ne peut pas reconnaître cette langue sur l’appareil ' +
            'lui-même, l’audio est envoyé au service de reconnaissance vocale du téléphone (celui d’Apple ou de ' +
            'Google), uniquement après que vous l’avez accepté une fois dans Qutai, et jamais dans les conversations ' +
            'privées. Qutai et le service d’IA ne reçoivent que le texte.\n' +
            '• Lorsque l’assistant vous présente des options sous forme de cartes, leurs images sont chargées depuis ' +
            'les sites (ou les serveurs d’images des sites) qui les affichent, sans vos cookies, y compris pour les ' +
            'options que vous n’ouvrez pas ; dans les conversations privées, uniquement lorsque vous touchez ' +
            '« Afficher les images ».\n' +
            '• Tant que « Bloquer les publicités et les traceurs » est activé, les listes de filtres que vous avez ' +
            'choisies sont téléchargées auprès de leurs éditeurs (comme EasyList et AdGuard) et mises à jour à ' +
            'quelques jours d’intervalle. Ces requêtes ne contiennent rien sur votre navigation.',
        },
        {
          heading: 'Votre compte Qutai',
          body:
            'Un compte est facultatif ; vous n’en avez besoin que pour les Qutai Credits, les achats dans ' +
            'l’application et les sauvegardes dans votre compte. Vous vous connectez avec Apple, avec Google ou avec ' +
            'votre adresse e-mail. Avec l’e-mail, nous envoyons à l’adresse que vous saisissez un message contenant ' +
            'un code à usage unique et un lien, via notre service d’e-mail (Mailjet) ; le code est valable 10 ' +
            'minutes et uniquement sur le téléphone qui l’a demandé, et pour prévenir les abus, le serveur compte ' +
            'combien de codes sont envoyés à chaque adresse et à chaque téléphone. Le serveur de Qutai conserve : un ' +
            'numéro de compte ; les méthodes de connexion du compte (Apple, Google, e-mail) et les adresses e-mail ' +
            'qui y sont associées (avec Apple, il peut s’agir d’une adresse de relais privée) ; la date à laquelle ' +
            'le compte a été créé et celle de sa dernière utilisation ; vos appareils connectés (un identifiant ' +
            'd’appareil aléatoire, et non les identifiants de votre téléphone) ; et vos crédits : le solde, les ' +
            'achats et les crédits ajoutés, ainsi que, pour chaque requête à l’assistant, le modèle, le nombre de ' +
            'tokens, ce qu’elle a coûté et sa date. Il ne conserve pas vos messages, vos pages ni vos réponses.',
        },
        {
          heading: 'Sauvegardes dans votre compte Qutai',
          body:
            'Uniquement si vous le choisissez (Paramètres › Sauvegarde), le serveur de Qutai conserve votre fichier ' +
            'de sauvegarde : les mêmes données qu’une sauvegarde que vous exportez (favoris, historique, mémoire de ' +
            'l’assistant, tâches enregistrées, paramètres des sites et préférences ; onglets ouverts, conversations, ' +
            'activité et clés IA uniquement si vous les incluez). Il est chiffré sur votre téléphone avec un mot de ' +
            'passe de votre choix avant d’être envoyé ; Qutai ne peut pas le lire et ne peut pas récupérer le mot de ' +
            'passe, qui n’est conservé que sur votre téléphone. Pour chaque sauvegarde, le serveur conserve ' +
            'également sa date de création, sa taille, la version de l’application et le type de téléphone (par ' +
            'exemple « iPhone · iOS 26 »). Les sauvegardes les plus récentes sont conservées (3 actuellement) et les ' +
            'plus anciennes sont supprimées ; vous pouvez les supprimer à tout moment, et la suppression de votre ' +
            'compte entraîne leur suppression.',
        },
        {
          heading: 'Achats dans l’application',
          body:
            'Les Qutai Credits et tout autre article vendu dans l’application s’achètent via l’App Store ou Google ' +
            'Play ; vos données de paiement restent chez Apple ou Google et ne parviennent jamais à Qutai. Un ' +
            'service de paiement (RevenueCat) reçoit votre numéro de compte Qutai et l’enregistrement de l’achat ' +
            'fourni par la boutique afin que l’achat puisse être confirmé, ajouté à votre compte et restauré sur un ' +
            'autre téléphone. Qutai conserve une trace de chaque achat (boutique, transaction, produit, crédits, ' +
            'prix payé et dates), que la législation fiscale nous impose de conserver, y compris après la ' +
            'suppression du compte, sans le lien avec vous. Les remboursements sont traités par Apple ou Google ' +
            'selon leurs propres règles.',
        },
        {
          heading: 'Le serveur de Qutai et les autres entités qui traitent des données',
          body:
            'Le serveur de Qutai fonctionne sur Cloudflare, qui stocke également les sauvegardes. Comme tout ' +
            'serveur, il voit votre adresse IP à chaque requête ; il ne l’utilise que pour limiter le nombre de ' +
            'requêtes pouvant être effectuées, et les journaux propres de Qutai ne contiennent jamais votre adresse ' +
            'IP, votre adresse e-mail, vos messages, vos pages ni vos jetons de connexion (ils contiennent un ' +
            'identifiant de requête, votre numéro de compte, ce qui a été demandé, la durée du traitement et, pour ' +
            'les requêtes à l’assistant, le modèle, les tokens et le coût). Les sociétés qui traitent des données ' +
            'pour le compte de Qutai, chacune selon sa propre politique de confidentialité, sont : ' +
            'Cloudflare (le serveur), Apple et Google (la connexion et les boutiques), Mailjet (les e-mails de ' +
            'connexion), RevenueCat (les achats) et, avec les Qutai Credits, Anthropic, OpenAI et Google (l’IA). ' +
            'Nous ne partageons vos données avec personne d’autre, sauf lorsque la loi l’exige (par exemple une ' +
            'décision de justice) ou pour protéger Qutai et ses utilisateurs contre la fraude et les abus.',
        },
        {
          heading: 'Durée de conservation des données',
          body:
            'Sur votre téléphone : jusqu’à ce que vous les supprimiez ou désinstalliez Qutai. Sur le serveur de ' +
            'Qutai : votre compte, ses méthodes de connexion, ses appareils et son historique de crédits jusqu’à ce ' +
            'que vous supprimiez le compte ; les sauvegardes comme décrit ci-dessus ; les codes de connexion jusqu’à ' +
            'leur utilisation ou leur expiration ; les traces d’achat aussi longtemps que la législation fiscale ' +
            'l’exige, sans le lien avec vous une fois le compte supprimé.',
        },
        {
          heading: 'Vos contacts',
          body:
            'Si vous l’autorisez, l’assistant peut trouver une personne que vous nommez (par exemple « appelle ' +
            'Thomas ») dans les contacts de votre téléphone. Qutai recherche uniquement les noms que vous dites ' +
            'vous-même, sur votre téléphone ; votre carnet d’adresses n’est jamais téléversé ni listé. Le service ' +
            'd’IA ne reçoit que les noms correspondants et le type de numéro ou d’adresse associé à chacun (comme ' +
            '« mobile » ou « e-mail professionnel »), jamais les numéros ou adresses eux-mêmes : vous les voyez sur ' +
            'le bouton ou le brouillon, et c’est vous qui appelez ou envoyez. Les numéros et adresses de vos ' +
            'contacts ne sont pas enregistrés avec vos conversations, la mémoire de l’assistant ou vos sauvegardes. ' +
            'Les contacts ne sont pas utilisés dans les conversations avec des onglets privés. Vous pouvez modifier ' +
            'l’autorisation dans Paramètres.',
        },
        {
          heading: 'Mots de passe et données de paiement',
          body:
            'Qutai ne permet pas à la mémoire de l’assistant de conserver des mots de passe, numéros de carte, codes ' +
            'de sécurité de carte, dates d’expiration de carte, codes à usage unique ou numéros de compte bancaire ' +
            '(IBAN). Les numéros de pièce d’identité et de passeport ne peuvent être conservés que dans les ' +
            'catégories identité ou voyage ; ils sont masqués pour le service d’IA, qui ne voit qu’une étiquette, et ' +
            'Qutai saisit lui-même le numéro sur un site après votre confirmation. Avant que l’assistant ne saisisse ' +
            'pour la première fois vos données personnelles enregistrées sur un site, Qutai vous le demande (vous ' +
            'pouvez modifier ce réglage pour chaque site). Vous pouvez aussi exiger votre confirmation avant chaque ' +
            'action, et bloquer l’assistant sur les sites de votre choix.',
        },
        {
          heading: 'Vos moyens de contrôle',
          body:
            'Vous pouvez consulter et supprimer la mémoire de l’assistant, effacer l’historique, les cookies et ' +
            'd’autres données dans Paramètres, et supprimer vos clés API à tout moment. Vous pouvez supprimer vos ' +
            'sauvegardes du serveur de Qutai dans Paramètres › Sauvegarde. Vous pouvez cesser d’utiliser les Qutai ' +
            'Credits, vous déconnecter ou supprimer votre compte dans Paramètres › Compte : sa suppression efface du ' +
            'serveur de Qutai le compte, son solde et son historique (les traces d’achat sont conservées sans le ' +
            'lien avec vous, comme indiqué ci-dessus) et demande au service de paiement de supprimer ses données ' +
            'vous concernant. Vous pouvez également écrire à osmanyuksel@gmail.com pour demander une copie de ce que ' +
            'le serveur de Qutai conserve à votre sujet, ou sa rectification ou son effacement. La désinstallation de Qutai supprime tout ce qu’il a stocké sur le téléphone, sauf les ' +
            'fichiers que vous avez enregistrés en dehors de l’application, comme les téléchargements ' +
            'dans le dossier Téléchargements d’Android et les images enregistrées dans vos Photos.',
        },
        {
          heading: 'Sécurité',
          body:
            'Les connexions au serveur de Qutai utilisent HTTPS. Les jetons de connexion ne sont conservés sur le ' +
            'serveur que sous forme hachée et, sur votre téléphone, dans son stockage chiffré, et les sauvegardes ' +
            'sont chiffrées sur votre téléphone avant d’être envoyées.',
        },
        {
          heading: 'Enfants',
          body:
            'Qutai ne s’adresse pas aux enfants de moins de 13 ans, et nous ne collectons pas sciemment de données ' +
            'les concernant. Dans certains pays, vous devez être plus âgé (par exemple 16 ans) pour accepter ' +
            'vous-même la présente politique ; en dessous de cet âge, un parent ou un tuteur légal doit donner son ' +
            'consentement pour vous.',
        },
        {
          heading: 'Modifications',
          body:
            'Si cette politique change, Qutai affiche la nouvelle version et vous demande de l’accepter avant de ' +
            'continuer. En cas de divergence entre cette traduction et la version anglaise, la version anglaise ' +
            'prévaut.',
        },
      ],
    },
    terms: {
      title: 'Conditions d’utilisation',
      intro:
        'En utilisant Qutai, vous acceptez les présentes conditions. Veuillez les lire conjointement avec la ' +
        'Politique de confidentialité.',
      sections: [
        {
          heading: 'Deux façons d’utiliser l’assistant',
          body:
            '• Votre propre clé API : vous êtes responsable de votre compte auprès de ce fournisseur, de ses ' +
            'conditions et de tous les coûts facturés sur votre clé.\n' +
            '• Qutai Credits : les requêtes de l’assistant passent par le serveur de Qutai et sont payées avec les ' +
            'crédits de votre compte Qutai. Vous avez besoin d’un compte pour les utiliser.',
        },
        {
          heading: 'Qutai Credits',
          body:
            'Les crédits s’achètent dans l’application via l’App Store ou Google Play, au prix affiché par la ' +
            'boutique, et sont ajoutés à votre compte Qutai une fois l’achat confirmé. Ils servent uniquement à ' +
            'payer les requêtes de l’assistant dans Qutai, aux prix en crédits indiqués pour chaque modèle ; le coût ' +
            'de chaque réponse est affiché sous celle-ci. Une requête réserve d’abord le montant maximal qu’elle ' +
            'pourrait coûter et restitue ce qu’elle n’a pas utilisé. Les crédits appartiennent à votre compte Qutai, ' +
            'peuvent être utilisés sur tout téléphone sur lequel vous vous connectez, ne peuvent être ni transférés ' +
            'ni échangés contre de l’argent, et ne sont pas remboursés, sauf lorsque la loi ou les règles de ' +
            'remboursement de la boutique l’exigent ; les remboursements sont traités par Apple ou Google. Si un ' +
            'achat est remboursé, ses crédits sont repris, ce qui peut rendre le solde négatif jusqu’à ce que vous ' +
            'le rechargiez. Les modèles, les prix en crédits et les limites peuvent changer ; ceux en vigueur sont ' +
            'affichés dans l’application avant que vous ne les utilisiez. Les Qutai Credits peuvent être suspendus ' +
            'pour maintenance ou être indisponibles par moments.',
        },
        {
          heading: 'Votre compte',
          body:
            'Assurez la sécurité de votre moyen de connexion (Apple, Google ou votre e-mail) ; ce qui est fait avec ' +
            'votre compte relève de votre responsabilité. Nous pouvons suspendre un compte qui enfreint les ' +
            'présentes conditions. Si vous supprimez votre compte, ses crédits restants sont perdus.',
        },
        {
          heading: 'L’assistant agit pour votre compte',
          body:
            'L’assistant peut lire des pages, cliquer, saisir du texte et remplir des formulaires lorsque vous le ' +
            'lui demandez. L’IA peut faire des erreurs : vérifiez ses réponses, et contrôlez les achats, ' +
            'réservations, messages et autres actions importantes avant qu’ils ne soient finalisés. Vous pouvez ' +
            'exiger une confirmation avant chaque action dans Paramètres.',
        },
        {
          heading: 'Utilisation acceptable',
          body:
            'N’utilisez pas Qutai ni les Qutai Credits pour enfreindre la loi, pour enfreindre les conditions des ' +
            'sites web ou des fournisseurs d’IA, pour nuire à autrui (par exemple en envoyant du spam ou en ' +
            'collectant les données d’autres personnes), ou pour utiliser abusivement ou surcharger le serveur de ' +
            'Qutai.',
        },
        {
          heading: 'Sites web et contenus',
          body: 'Les sites web et leurs contenus appartiennent à leurs propriétaires. Qutai n’en est pas responsable.',
        },
        {
          heading: 'Absence de garantie',
          body:
            'Qutai est fourni « en l’état », sans garantie. Dans la mesure permise par la loi, nous ne sommes pas ' +
            'responsables des pertes résultant de son utilisation, y compris des actions effectuées par l’assistant.',
        },
        {
          heading: 'Modifications',
          body:
            'Si ces conditions changent, Qutai affiche la nouvelle version et vous demande de l’accepter avant de ' +
            'continuer. En cas de divergence entre cette traduction et la version anglaise, la version anglaise ' +
            'prévaut.',
        },
      ],
    },
  },
};
