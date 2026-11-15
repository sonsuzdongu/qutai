package expo.modules.qutaiauth

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sign in with Google on Android for pro-mode accounts (src/account/providers.ts): Credential Manager's
 * "Sign in with Google" button flow, which shows Google's account picker and returns an ID token.
 * The JavaScript side passes the server (web) client id and the nonce (the SHA-256 of the raw nonce the server
 * checks); the token is handed straight back and never stored here.
 */
class QutaiAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("QutaiAuth")

    AsyncFunction("googleSignIn") Coroutine { serverClientId: String, nonce: String ->
      val activity = appContext.currentActivity
        ?: throw CodedException("ERR_NO_ACTIVITY", "Qutai is not in the foreground.", null)
      val option = GetSignInWithGoogleOption.Builder(serverClientId).setNonce(nonce).build()
      val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
      val credential = try {
        CredentialManager.create(activity).getCredential(activity, request).credential
      } catch (e: GetCredentialCancellationException) {
        throw CodedException("ERR_CANCELED", "Sign-in was cancelled.", e)
      } catch (e: NoCredentialException) {
        throw CodedException("ERR_NO_CREDENTIAL", "No Google account is available.", e)
      } catch (e: GetCredentialException) {
        throw CodedException("ERR_GOOGLE_SIGN_IN", e.type, e)
      }
      if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
        throw CodedException("ERR_GOOGLE_SIGN_IN", "Unexpected credential type.", null)
      }
      try {
        mapOf("idToken" to GoogleIdTokenCredential.createFrom(credential.data).idToken)
      } catch (e: GoogleIdTokenParsingException) {
        throw CodedException("ERR_GOOGLE_SIGN_IN", "The Google answer could not be read.", e)
      }
    }
  }
}
